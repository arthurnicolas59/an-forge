import type { EngineInterface } from 'claude-code'

import type { Board, BoardSpec, BoardTicket, TicketState } from '../types'

// Le tableau des tickets : ce qu'il reste à faire sur le projet, spec par spec.
// Lit GitHub (une requête GraphQL) ou les fichiers locaux .scratch/<spec>/issues/*.md,
// selon docs/agents/issue-tracker.md. Ne modifie rien.

export const TRACKER_DOC = 'docs/agents/issue-tracker.md'

// ---------------------------------------------------------------------------
// GitHub

type GhLabel = { name: string }
export type GhIssue = {
  number: number
  title: string
  state: 'OPEN' | 'CLOSED'
  body?: string
  labels?: { nodes: GhLabel[] }
  assignees?: { totalCount: number }
  blockedBy?: { nodes: { number: number; state: 'OPEN' | 'CLOSED' }[] }
  parent?: { number: number; title: string; state: 'OPEN' | 'CLOSED' } | null
  subIssuesSummary?: { total: number; completed: number }
  subIssues?: { nodes: GhIssue[] }
}

const FIELDS = `number title state body labels(first:20){nodes{name}} assignees(first:1){totalCount} blockedBy(first:20){nodes{number state}}`

export const GH_QUERY = `query($o:String!,$r:String!){repository(owner:$o,name:$r){
issues(states:OPEN,first:100,orderBy:{field:CREATED_AT,direction:ASC}){nodes{${FIELDS} parent{number title state} subIssuesSummary{total completed} subIssues(first:60){nodes{${FIELDS}}}}}
pullRequests(states:OPEN,first:60){nodes{number headRefName}}}}`

/** Les numéros cités dans la section « Blocked by » d'un corps de ticket. */
export const blockersInBody = (body: string): number[] => {
  const out: number[] = []
  let inside = false
  for (const line of body.split('\n')) {
    if (/^\s*#*\s*\**\s*blocked by\b/i.test(line)) {
      inside = true
      for (const m of line.matchAll(/#(\d+)/g)) out.push(Number(m[1]))
      continue
    }
    if (!inside) continue
    if (/^\s*#{1,6}\s/.test(line) || /^\s*\*\*[^*]+:\*\*/.test(line)) break
    for (const m of line.matchAll(/#(\d+)/g)) out.push(Number(m[1]))
  }
  return [...new Set(out)]
}

/** Du markdown au texte brut : sans gras, liens, code, cases à cocher. */
export const plain = (md: string): string =>
  md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*[-*]\s+\[[ xX]\]\s*/gm, '- ')
    .replace(/[*_`]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const ABOUT = /(what to build|ce qu.il faut construire|objectif|à construire)/i

/** La partie « What to build » d'un ticket (titre de section ou ligne **What to build:**), sinon son début. */
export const aboutOf = (body: string): string => {
  const lines = body.split('\n')
  let out: string[] | null = null
  for (const line of lines) {
    if (out === null) {
      if (/^\s*#{1,6}\s/.test(line) && ABOUT.test(line)) out = []
      else if (/^\s*\*\*[^*]+:?\*\*:?/.test(line) && ABOUT.test(line.split(/:\*\*|\*\*:/)[0] ?? '')) out = [line.replace(/^\s*\*\*[^*]+\*\*:?\s*/, '')]
      continue
    }
    if (/^\s*#{1,6}\s/.test(line) || /^\s*\*\*[^*]+:\*\*/.test(line) || /^\s*- \[[ xX]\]/.test(line)) break
    out.push(line)
  }
  const text = out?.join('\n').trim()
  if (text) return plain(text).slice(0, 1500)
  // Pas de section : le corps sans sa section « Parent » ni ses critères.
  return plain(body.replace(/^##\s*Parent[\s\S]*?(?=^##\s)/m, '').replace(/^#.*$/gm, '')).slice(0, 800)
}

/** La première phrase, sans ses parenthèses : la phrase de secours quand le modèle ne répond pas. */
export const firstSentence = (text: string): string => {
  const flat = text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim()
  const m = flat.match(/^(.+?[.!?])(\s|$)/)
  const s = (m?.[1] ?? flat).replace(/\s+([.,;:!?])/g, '$1')
  return s.length > 220 ? s.slice(0, 219) + '…' : s
}

const ticketBranch = (n: number) => new RegExp(`^(?:origin/)?ticket/${n}-`)

export type GhExtras = { prs: { number: number; headRefName: string }[]; branches: string[] }

const stateOfGh = (i: GhIssue, open: Set<number>, extras: GhExtras): Pick<BoardTicket, 'state' | 'waitsOn' | 'pr'> => {
  if (i.state === 'CLOSED') return { state: 'done', waitsOn: [] }
  const labels = (i.labels?.nodes ?? []).map(l => l.name)
  const native = (i.blockedBy?.nodes ?? []).filter(b => b.state === 'OPEN').map(b => b.number)
  const written = (i.blockedBy?.nodes.length ?? 0) > 0 ? [] : blockersInBody(i.body ?? '').filter(n => open.has(n))
  const waitsOn = [...new Set([...native, ...written])].sort((a, b) => a - b)
  const pr = extras.prs.find(p => ticketBranch(i.number).test(p.headRefName))
  if (pr) return { state: 'review', waitsOn, pr: pr.number }
  if (labels.includes('needs-info')) return { state: 'question', waitsOn }
  if (labels.includes('ready-for-human')) return { state: 'human', waitsOn }
  if ((i.assignees?.totalCount ?? 0) > 0 || extras.branches.some(b => ticketBranch(i.number).test(b))) return { state: 'building', waitsOn }
  if (!labels.includes('ready-for-agent')) return { state: 'draft', waitsOn }
  return { state: waitsOn.length ? 'waiting' : 'ready', waitsOn }
}

const tailleOf = (i: GhIssue): string | undefined =>
  (i.labels?.nodes ?? []).map(l => l.name).find(n => n.startsWith('taille:'))?.slice('taille:'.length)

/** Range les issues ouvertes (et les tickets fermés des specs ouvertes) par spec. */
export const boardFromGithub = (repo: string, issues: GhIssue[], extras: GhExtras, at: number): Board => {
  const all = new Map<number, GhIssue>()
  for (const i of issues) {
    all.set(i.number, i)
    for (const s of i.subIssues?.nodes ?? []) if (!all.has(s.number)) all.set(s.number, { ...s, parent: { number: i.number, title: i.title, state: i.state } })
  }
  const open = new Set([...all.values()].filter(i => i.state === 'OPEN').map(i => i.number))
  const isSpec = (i: GhIssue) => (i.subIssuesSummary?.total ?? 0) > 0

  const specs = new Map<number | 'none', BoardSpec>()
  const specOf = (key: number | 'none', title: string, isOpen: boolean): BoardSpec => {
    let s = specs.get(key)
    if (!s) {
      s = { ...(key === 'none' ? {} : { n: key }), ref: key === 'none' ? '' : `#${key}`, title, isOpen, tickets: [] }
      specs.set(key, s)
    }
    return s
  }
  for (const i of issues) if (isSpec(i)) specOf(i.number, i.title, true)

  for (const i of all.values()) {
    if (isSpec(i)) continue
    const p = i.parent
    // Hors d'une spec, un ticket fermé ne dit plus rien.
    if (!p && i.state === 'CLOSED') continue
    const spec = p ? specOf(p.number, p.title, p.state === 'OPEN') : specOf('none', 'Hors spec', true)
    const taille = tailleOf(i)
    const about = aboutOf(i.body ?? '')
    spec.tickets.push({ n: i.number, ref: `#${i.number}`, title: i.title, ...(taille ? { taille } : {}), ...(about ? { about } : {}), ...stateOfGh(i, open, extras) })
  }
  return finish({ source: 'github', where: repo, specs: [...specs.values()], loadedAt: at })
}

// ---------------------------------------------------------------------------
// Fichiers locaux

const field = (text: string, name: string): string | undefined =>
  text.match(new RegExp(`^\\s*\\**${name}:?\\**:?\\s*(.+)$`, 'im'))?.[1]?.trim()

/** Un fichier .scratch/<spec>/issues/NN-slug.md. */
export const ticketFromFile = (file: string, text: string): BoardTicket | null => {
  const num = file.match(/^(\d+)/)?.[1]
  if (!num) return null
  const n = Number(num)
  const title = text.match(/^#\s*\d*\s*:?\s*(.+)$/m)?.[1]?.trim() || file.replace(/^\d+-/, '').replace(/\.md$/, '').replace(/-/g, ' ')
  const status = (field(text, 'Status') ?? '').toLowerCase()
  const blocked = (field(text, 'Blocked by') ?? '').replace(/\([^)]*\)/g, '')
  const waitsOn = /^none|^aucun/i.test(blocked) ? [] : [...blocked.matchAll(/\b(\d{1,3})\b/g)].map(m => Number(m[1]))
  const taille = field(text, 'Taille')?.toLowerCase().match(/petit|moyen|gros/)?.[0]
  let state: TicketState
  if (/done|closed|termin|fait|merged/.test(status)) state = 'done'
  else if (/needs-info/.test(status)) state = 'question'
  else if (/ready-for-human/.test(status)) state = 'human'
  else if (/in-progress|building|en cours|wip/.test(status)) state = 'building'
  else if (/ready-for-agent/.test(status)) state = 'ready'
  else state = 'draft'
  const about = aboutOf(text)
  return { n, ref: num, title, state, waitsOn, ...(taille ? { taille } : {}), ...(about ? { about } : {}) }
}

/** Un ticket local prêt dont un blocage n'est pas fait attend. */
export const settleLocal = (tickets: BoardTicket[]): BoardTicket[] => {
  const done = new Set(tickets.filter(t => t.state === 'done').map(t => t.n))
  return tickets.map(t => {
    const waitsOn = t.state === 'done' ? [] : t.waitsOn.filter(n => !done.has(n))
    const state: TicketState = t.state === 'ready' && waitsOn.length ? 'waiting' : t.state
    return { ...t, waitsOn, state }
  })
}

// ---------------------------------------------------------------------------

const ORDER: Record<TicketState, number> = { review: 0, question: 1, human: 2, building: 3, ready: 4, waiting: 5, draft: 6, done: 7 }

const finish = (b: Board): Board => ({
  ...b,
  specs: b.specs
    .map(s => ({ ...s, tickets: [...s.tickets].sort((x, y) => x.n - y.n).map(t => ({ ...t, key: `${s.ref}|${t.ref}` })) }))
    // Une spec dont tout est fait ne reste que si elle est encore ouverte.
    .filter(s => s.tickets.some(t => t.state !== 'done') || (s.isOpen && s.tickets.length > 0))
    .sort((x, y) => (x.n === undefined ? 1 : y.n === undefined ? -1 : x.n - y.n)),
})

/** Les tickets d'un tableau, toutes specs confondues. */
export const ticketsOf = (b: Board): BoardTicket[] => b.specs.flatMap(s => s.tickets)

export const countOf = (b: Board) => {
  const t = ticketsOf(b)
  const c = (...s: TicketState[]) => t.filter(x => s.includes(x.state)).length
  return { total: t.length, done: c('done'), live: c('building', 'review'), ready: c('ready'), waiting: c('waiting', 'draft'), you: c('review', 'question', 'human') }
}

export type NextStep = { ticket: BoardTicket; text: string; command?: string }

/** Ce qu'il y a à faire maintenant, le plus urgent d'abord : ce qui t'attend, puis les tickets libres. */
export const nextSteps = (b: Board): NextStep[] => {
  const local = b.source === 'local'
  return ticketsOf(b)
    .filter(t => t.state === 'review' || t.state === 'question' || t.state === 'human' || t.state === 'ready')
    .sort((x, y) => ORDER[x.state] - ORDER[y.state] || x.n - y.n)
    .map((t): NextStep => {
      switch (t.state) {
        case 'review':
          return { ticket: t, text: `PR #${t.pr} attend ta décision`, command: `merge la PR #${t.pr}` }
        case 'question':
          return { ticket: t, text: 'une question t’attend', command: local ? '/build-ticket' : `/build-ticket ${t.n}` }
        case 'human':
          return { ticket: t, text: 'construction arrêtée, à reprendre' }
        default:
          return { ticket: t, text: 'prêt à construire', command: local ? '/build-ticket' : `/build-ticket ${t.n}` }
      }
    })
}

// ---------------------------------------------------------------------------
// Chargement

const firstLine = (s: string): string => s.trim().split('\n')[0] ?? ''

async function loadGithub($: EngineInterface, cwd: string, at: number): Promise<Board> {
  const repo = await $.process.run(['gh', 'repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { cwd })
  const name = repo.stdout.trim()
  if (repo.exitCode !== 0 || !name.includes('/')) {
    return { source: 'github', where: '', specs: [], loadedAt: at, error: `gh ne trouve pas le dépôt GitHub : ${firstLine(repo.stderr || repo.stdout) || 'pas de remote'}` }
  }
  const [o, r] = name.split('/') as [string, string]
  const [q, refs] = await Promise.all([
    $.process.run(['gh', 'api', 'graphql', '-f', `query=${GH_QUERY}`, '-F', `o=${o}`, '-F', `r=${r}`], { cwd, timeoutMs: 45_000 }),
    $.process.run(['git', 'for-each-ref', '--format=%(refname:short)', 'refs/heads/ticket/', 'refs/remotes/origin/ticket/'], { cwd }).catch(() => null),
  ])
  if (q.exitCode !== 0) {
    return { source: 'github', where: name, specs: [], loadedAt: at, error: `GitHub n'a pas répondu : ${firstLine(q.stderr || q.stdout)}` }
  }
  const data = JSON.parse(q.stdout) as { data?: { repository?: { issues: { nodes: GhIssue[] }; pullRequests: { nodes: GhExtras['prs'] } } } }
  const repoData = data.data?.repository
  if (!repoData) return { source: 'github', where: name, specs: [], loadedAt: at, error: 'réponse GitHub vide' }
  const branches = refs && refs.exitCode === 0 ? refs.stdout.split('\n').map(s => s.trim()).filter(Boolean) : []
  return boardFromGithub(name, repoData.issues.nodes, { prs: repoData.pullRequests.nodes, branches }, at)
}

async function loadLocal($: EngineInterface, cwd: string, at: number): Promise<Board> {
  const root = `${cwd}/.scratch`
  const specs: BoardSpec[] = []
  const dirs = (await $.fs.list(root).catch(() => [])).filter(d => d.kind === 'dir').sort((a, b) => a.name.localeCompare(b.name))
  for (const d of dirs) {
    const files = (await $.fs.list(`${root}/${d.name}/issues`).catch(() => [])).filter(f => f.kind === 'file' && f.name.endsWith('.md'))
    if (!files.length) continue
    const specText = await $.fs.read(`${root}/${d.name}/spec.md`).catch(() => '')
    const title = specText.match(/^#\s*(?:Spec\s*:\s*)?(.+)$/m)?.[1]?.trim() || d.name.replace(/-/g, ' ')
    const tickets: BoardTicket[] = []
    for (const f of files) {
      const t = ticketFromFile(f.name, await $.fs.read(`${root}/${d.name}/issues/${f.name}`).catch(() => ''))
      if (t) tickets.push(t)
    }
    specs.push({ ref: d.name, title, isOpen: true, tickets: settleLocal(tickets) })
  }
  return finish({ source: 'local', where: '.scratch', specs, loadedAt: at })
}

/** Lit le tableau du projet ouvert, ou null quand ce n'est pas un projet an-forge. */
export async function loadBoard($: EngineInterface, at: number): Promise<Board | null> {
  const cwd = await $.session.cwd()
  const doc = await $.fs.read(`${cwd}/${TRACKER_DOC}`).catch(() => null)
  if (doc === null) return null
  const isLocal = /local markdown|\.scratch/i.test(doc.split('\n').slice(0, 4).join('\n'))
  try {
    return isLocal ? await loadLocal($, cwd, at) : await loadGithub($, cwd, at)
  } catch (err) {
    return { source: isLocal ? 'local' : 'github', where: '', specs: [], loadedAt: at, error: firstLine(String(err)).slice(0, 200) }
  }
}
