#!/usr/bin/env node
// Le serveur du tableau de suivi an-forge. Il ne fait que lire : rien n'est modifié, ni sur GitHub,
// ni dans les projets. Il n'écoute que sur cette machine (127.0.0.1).
//
// Il réunit, pour chaque projet de ~/.an-forge/projects :
//   - les specs, les tickets et les pull requests, lus sur GitHub (une requête, gardée 20 secondes) ;
//   - les branches ticket/<n>-… présentes sur la machine ;
//   - le journal écrit par /build-ticket : ~/.an-forge/journal/<projet>/<n>.jsonl.
//
// Usage : node server.mjs        (port : AN_FORGE_DASHBOARD_PORT, 4317 par défaut)
// Sans dépendance : Node 18 ou plus suffit.

import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME_DIR = process.env.AN_FORGE_HOME || join(homedir(), '.an-forge');
const PORT = Number(process.env.AN_FORGE_DASHBOARD_PORT || 4317);
const GITHUB_TTL_MS = 20_000;

// Les étapes de /build-ticket, dans l'ordre. « critere » et « arrete » n'en font pas partie.
export const STEPS = ['isoler', 'avant', 'construire', 'tester', 'relire', 'apres', 'brief', 'pr'];

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, maxBuffer: 20 * 1024 * 1024, timeout: 30_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || err.message).trim()));
      else resolve(stdout);
    });
  });
}

async function readLines(file) {
  try {
    return (await readFile(file, 'utf8')).split('\n').filter((l) => l.trim());
  } catch {
    return [];
  }
}

async function projectPaths() {
  const lines = await readLines(join(HOME_DIR, 'projects'));
  return [...new Set(lines.map((l) => l.trim()))];
}

// owner/name depuis l'adresse du dépôt origin (https ou ssh).
export function repoFromRemote(url) {
  const m = url.trim().match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
  return m ? { owner: m[1], name: m[2] } : null;
}

const QUERY = `query($o:String!,$n:String!){repository(owner:$o,name:$n){
  url
  issues(first:100,orderBy:{field:CREATED_AT,direction:ASC}){nodes{
    number title state url body closedAt
    labels(first:20){nodes{name}}
    assignees(first:5){totalCount}
    parent{number}
    subIssues(first:1){totalCount}
    blockedBy(first:20){nodes{number state}}
  }}
  pullRequests(first:100,orderBy:{field:CREATED_AT,direction:DESC}){nodes{
    number title state url headRefName mergedAt
  }}
}}`;

const githubCache = new Map();

async function githubData(path, repo) {
  const key = `${repo.owner}/${repo.name}`;
  const hit = githubCache.get(key);
  if (hit && Date.now() - hit.at < GITHUB_TTL_MS) return hit.data;
  const out = await run('gh', ['api', 'graphql', '-f', `query=${QUERY}`, '-f', `o=${repo.owner}`, '-f', `n=${repo.name}`], path);
  const data = JSON.parse(out).data.repository;
  githubCache.set(key, { at: Date.now(), data });
  return data;
}

// Les lignes « - [ ] … » sous un titre « Critères d'acceptation » (ou « Acceptance criteria »).
export function parseCriteria(body) {
  const lines = (body || '').split('\n');
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      inside = /crit[eè]res? d.acceptation|acceptance criteria/i.test(line);
      continue;
    }
    if (!inside) continue;
    const m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (m) out.push({ text: m[2].trim(), checked: m[1] !== ' ' });
  }
  return out;
}

// Le texte sous « Ce qu'il faut construire » (ou « What to build »), jusqu'au titre suivant.
export function parseWhat(body) {
  const lines = (body || '').split('\n');
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (/^#{1,6}\s/.test(line)) {
      if (inside) break;
      inside = /ce qu.il faut construire|what to build/i.test(line);
      continue;
    }
    if (inside) out.push(line);
  }
  return out.join('\n').trim();
}

// L'état d'un ticket, en un mot, à partir de GitHub, des branches locales et du journal.
//   merged | review | stopped | building | blocked | ready | not-ready
export function ticketStatus({ issue, pr, hasBranch, journal }) {
  if (issue.state === 'CLOSED') return 'merged';
  if (pr && pr.state === 'OPEN') return 'review';
  const steps = journal.filter((e) => e.step !== 'critere');
  const last = steps[steps.length - 1];
  if (last && last.step === 'arrete') return 'stopped';
  if (hasBranch || steps.length || issue.assignees.totalCount > 0) return 'building';
  if (issue.blockedBy.nodes.some((b) => b.state === 'OPEN')) return 'blocked';
  if (issue.labels.nodes.some((l) => l.name === 'ready-for-agent')) return 'ready';
  return 'not-ready';
}

async function readJournal(project, number) {
  const lines = await readLines(join(HOME_DIR, 'journal', project, `${number}.jsonl`));
  const out = [];
  for (const l of lines) {
    try {
      out.push(JSON.parse(l));
    } catch {
      // Une ligne abîmée ne doit pas cacher les autres.
    }
  }
  return out;
}

async function localTicketBranches(path) {
  try {
    const out = await run('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads/ticket/', 'refs/remotes/origin/ticket/'], path);
    const nums = new Set();
    for (const ref of out.split('\n')) {
      const m = ref.match(/ticket\/(\d+)-/);
      if (m) nums.add(Number(m[1]));
    }
    return nums;
  } catch {
    return new Set();
  }
}

async function loadProject(path) {
  const name = basename(path);
  const project = { name, path, repo: null, url: null, specs: [], tickets: [], error: null };
  if (!existsSync(path)) {
    project.error = `Le dossier n'existe plus : ${path}`;
    return project;
  }
  let repo;
  try {
    repo = repoFromRemote(await run('git', ['remote', 'get-url', 'origin'], path));
  } catch {
    repo = null;
  }
  if (!repo) {
    project.error = "Ce projet n'a pas de dépôt GitHub (origin).";
    return project;
  }
  project.repo = `${repo.owner}/${repo.name}`;

  let gh;
  try {
    gh = await githubData(path, repo);
  } catch (e) {
    project.error = `GitHub ne répond pas : ${e.message.split('\n')[0]}`;
    return project;
  }
  project.url = gh.url;
  const branches = await localTicketBranches(path);

  // Une pull request appartient au ticket <n> si sa branche s'appelle ticket/<n>-…
  const prByTicket = new Map();
  for (const pr of gh.pullRequests.nodes) {
    const m = pr.headRefName.match(/^ticket\/(\d+)-/);
    if (!m) continue;
    const n = Number(m[1]);
    const prev = prByTicket.get(n);
    if (!prev || (prev.state !== 'OPEN' && pr.state === 'OPEN')) prByTicket.set(n, pr);
  }

  for (const issue of gh.issues.nodes) {
    if (issue.subIssues.totalCount > 0) {
      project.specs.push({ number: issue.number, title: issue.title, url: issue.url, open: issue.state === 'OPEN' });
      continue;
    }
    const journal = await readJournal(name, issue.number);
    const pr = prByTicket.get(issue.number) || null;
    const status = ticketStatus({ issue, pr, hasBranch: branches.has(issue.number), journal });
    const steps = journal.filter((e) => e.step !== 'critere');
    const proofs = new Map();
    for (const e of journal) if (e.step === 'critere' && e.criterion) proofs.set(e.criterion, e);
    project.tickets.push({
      number: issue.number,
      title: issue.title,
      url: issue.url,
      spec: issue.parent ? issue.parent.number : null,
      status,
      step: steps.length ? steps[steps.length - 1].step : null,
      what: parseWhat(issue.body),
      criteria: parseCriteria(issue.body).map((c, i) => {
        const proof = proofs.get(i + 1);
        // Un ticket mergé a tous ses critères acquis, même si ses cases ne sont pas cochées sur GitHub.
        return { text: c.text, done: c.checked || Boolean(proof) || status === 'merged', proof: proof ? proof.message : null };
      }),
      blockers: issue.blockedBy.nodes.map((b) => ({ number: b.number, open: b.state === 'OPEN' })),
      pr: pr ? { number: pr.number, url: pr.url, state: pr.state } : null,
      closedAt: issue.closedAt,
      journal,
    });
  }

  // Le prochain ticket : le premier prêt, celui qui a le plus petit numéro (comme /build-ticket).
  const next = project.tickets.filter((t) => t.status === 'ready').sort((a, b) => a.number - b.number)[0];
  if (next) next.next = true;
  return project;
}

async function state() {
  const paths = await projectPaths();
  const projects = await Promise.all(paths.map(loadProject));
  return { generatedAt: new Date().toISOString(), home: HOME_DIR, projects };
}

// N'accepte que les requêtes adressées à cette machine : une page web d'ailleurs ne peut pas lire le tableau.
function localHost(req) {
  const host = (req.headers.host || '').replace(/:\d+$/, '');
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]';
}

function send(res, code, type, body) {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}

const server = createServer(async (req, res) => {
  if (!localHost(req)) return send(res, 403, 'text/plain; charset=utf-8', 'Accès refusé');
  if (req.method !== 'GET') return send(res, 405, 'text/plain; charset=utf-8', 'Lecture seule');
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    if (url.pathname === '/') {
      return send(res, 200, 'text/html; charset=utf-8', await readFile(join(HERE, 'index.html')));
    }
    if (url.pathname === '/api/ping') {
      return send(res, 200, 'application/json', JSON.stringify({ app: 'an-forge-dashboard', dir: HERE, pid: process.pid }));
    }
    if (url.pathname === '/api/state') {
      if (url.searchParams.has('refresh')) githubCache.clear();
      return send(res, 200, 'application/json', JSON.stringify(await state()));
    }
    send(res, 404, 'text/plain; charset=utf-8', 'Introuvable');
  } catch (e) {
    send(res, 500, 'text/plain; charset=utf-8', e.message);
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`an-forge dashboard : http://127.0.0.1:${PORT}`);
  });
}
