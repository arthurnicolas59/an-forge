import { expect, test } from 'claude-code/testing'

import { aboutOf, blockersInBody, firstSentence, settleLocal, ticketFromFile } from './board'

declare const console: { log: (text: string) => void }

const BAND = {
  plugin: 'forge-progress',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 4, bodyColumns: 140, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const

const PANE = {
  plugin: 'forge-progress',
  component: 'Pane',
  requestId: 'forge-progress',
  props: { title: 'Ticket statut', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

// Calqué sur un vrai projet : une spec, deux tickets faits, #4 libre, #8 en PR, le reste attend.
const issue = (number: number, title: string, state: 'OPEN' | 'CLOSED', blockedBy: [number, 'OPEN' | 'CLOSED'][] = [], extra: object = {}) => ({
  number,
  title,
  state,
  body: '## What to build\n\n…',
  labels: { nodes: [{ name: 'ready-for-agent' }] },
  assignees: { totalCount: 0 },
  blockedBy: { nodes: blockedBy.map(([n, s]) => ({ number: n, state: s })) },
  ...extra,
})
const BODY4 =
  "## Parent\n\n#1\n\n## Ce qu'il faut construire\n\nLes deux scripts qui relient Claude Code au **catalogue** (ADR 0001 et 0002 : connexion directe). Import et export.\n\n## Critères d'acceptation\n\n- [ ] Le schéma est ajouté.\n"
const SUBS = [
  issue(2, 'Socle', 'CLOSED'),
  issue(3, 'Profil de goûts', 'CLOSED', [[2, 'CLOSED']]),
  issue(4, 'Import et export du catalogue', 'OPEN', [[2, 'CLOSED']], { body: BODY4 }),
  issue(5, 'Idées du soir', 'OPEN', [[3, 'CLOSED'], [4, 'OPEN']]),
  issue(6, 'Avis et historique', 'OPEN', [[5, 'OPEN']]),
  issue(7, 'Restaurants favoris', 'OPEN', [], { body: '## Blocked by\n\n- #4\n- #5\n' }),
  issue(8, 'Skill /enrichir', 'OPEN'),
  issue(9, 'Bandeau catalogue', 'OPEN', [[7, 'OPEN']], { labels: { nodes: [{ name: 'ready-for-agent' }, { name: 'needs-info' }] } }),
]
const GRAPHQL = {
  data: {
    repository: {
      issues: {
        nodes: [
          { ...issue(1, 'Spec : Recipe V1', 'OPEN'), parent: null, subIssuesSummary: { total: 8, completed: 2 }, subIssues: { nodes: SUBS } },
          ...SUBS.filter(s => s.state === 'OPEN').map(s => ({ ...s, parent: { number: 1, title: 'Spec : Recipe V1', state: 'OPEN' }, subIssuesSummary: { total: 0, completed: 0 }, subIssues: { nodes: [] } })),
          { ...issue(20, 'Petit bug du menu', 'OPEN'), parent: null, subIssuesSummary: { total: 0, completed: 0 }, subIssues: { nodes: [] } },
        ],
      },
      pullRequests: { nodes: [{ number: 31, headRefName: 'ticket/8-skill-enrichir' }] },
    },
  },
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const engine = (on: (event: any, hook: (...args: any[]) => unknown) => void) => {
  on('command.register', () => ({ value: { command: 'ticket-statut' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.panes', () => ({ value: [] }) as never)
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/p' }) as never)
  on('clock.every', () => ({ value: { cancel: () => {} } }) as never)
  on('fs.read', (_: unknown, e: { path: string }) => (e.path === '/p/docs/agents/issue-tracker.md' ? { value: '# Issue tracker: GitHub\n' } : { deny: 'ENOENT' }) as never)
  on('model.complete', (_: unknown, e: { prompt: string }) => ({
    value: { isAnswered: true, text: String(e.prompt).includes('Import et export') ? 'Tu pourras ajouter des recettes en masse et sortir ton catalogue pour Claude.' : 'Autre.', usage: { input_tokens: 1, output_tokens: 1 } },
  }) as never)
  on('process.run', (_: unknown, e: { argv: string[] }) => {
    const [cmd, sub] = e.argv
    const stdout = cmd === 'gh' && sub === 'repo' ? 'arthur/recipe\n' : cmd === 'gh' && sub === 'api' ? JSON.stringify(GRAPHQL) : ''
    return { value: { exitCode: 0, stdout, stderr: '' } } as never
  })
}

const textsOf = async (ui: { findAll: (q: { type: string }) => Promise<{ text: string }[]> }) => {
  const lines: string[] = []
  for (const t of await ui.findAll({ type: 'Text' })) {
    const s = t.text.trimEnd()
    if (s && !lines.some(l => l.includes(s))) lines.push(s)
  }
  return lines
}

test('/ticket-statut projet : ce qu’il reste à faire, spec par spec', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  const ran = await $.command.run({ command: 'ticket-statut', args: 'tickets' } as never)
  expect(JSON.stringify(ran)).toMatch(/tickets du projet/i)
  await $.command.run({ command: 'ticket-statut', args: 'tickets' } as never)

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  console.log('\n──── /ticket-statut projet ────\n' + (await textsOf(pane)).join('\n') + '\n────────────────────────')
  expect(await pane.find({ type: 'Text', text: /^2\/9$/ })).toBeTruthy()
  // Le plus urgent d'abord : la PR à décider, la question, puis le ticket libre.
  expect(await pane.find({ type: 'Text', text: /PR #31 attend ta décision/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /→ \/build-ticket 4/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /→ \/build-ticket 9/ })).toBeTruthy()
  // #7 n'a que des blocages écrits dans son corps.
  expect(await pane.find({ type: 'Text', text: /^attend #4, #5$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^attend #5$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /Hors spec/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /2\/8 faits/ })).toBeTruthy()
  await pane.unmount()

  // Sans ticket en cours, la barre dit quoi lancer.
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  console.log('\n──── barre ────\n' + (await textsOf(band)).join('\n'))
  expect(await band.find({ type: 'Text', text: /2\/9 faits/ })).toBeTruthy()
  expect(await band.find({ type: 'Text', text: /merge la PR #31/ })).toBeTruthy()
  await band.unmount()

  // Un clic sur #4 : sa phrase d'objectif apparaît dessous ; un second clic la replie.
  const p2 = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await p2.press({ key: 'pick-#1|#4' })
  expect(await p2.find({ type: 'Text', text: /↳ Tu pourras ajouter des recettes en masse/ })).toBeTruthy()
  console.log('\n──── après un clic sur #4 ────\n' + (await textsOf(p2)).slice(0, 22).join('\n'))
  await p2.press({ key: 'pick-#1|#4' })
  expect(await p2.find({ type: 'Text', text: /↳/ })).toBeFalsy()
  await p2.unmount()
})

test('hors projet an-forge : pas de barre, et le panneau le dit', async ($, on) => {
  on('command.register', () => ({ value: { command: 'ticket-statut' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/ailleurs' }) as never)
  on('clock.every', () => ({ value: { cancel: () => {} } }) as never)
  on('fs.read', () => ({ deny: 'ENOENT' }) as never)
  await $.session.start({ cwd: '/ailleurs', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'ticket-statut', args: 'tickets' } as never)
  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Text', text: /faits/ })).toBeFalsy()
  await band.unmount()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /Pas de tickets an-forge ici/ })).toBeTruthy()
  await pane.unmount()
})

test('tickets locaux : statut, blocages et taille lus dans le fichier', async () => {
  const t = ticketFromFile(
    '05-idees-du-soir.md',
    '# 05: Idées du soir\n\n**What to build:** …\n\n**Blocked by:** 02 (Enregistrer une matinée), 04 (Alertes)\n\n**Status:** ready-for-agent\n\n**Taille:** moyen\n',
  )
  expect(t).toEqual({ n: 5, ref: '05', title: 'Idées du soir', state: 'ready', waitsOn: [2, 4], taille: 'moyen', about: '…' })
  const done = ticketFromFile('02-x.md', '# 02: X\n\n**Blocked by:** None (can start immediately)\n\n**Status:** done\n')
  const [, five] = settleLocal([done!, t!])
  expect(five?.state).toBe('waiting')
  expect(five?.waitsOn).toEqual([4])
  expect(blockersInBody('## Blocked by\n\n- #4\n- #5\n\n## Notes\n#9')).toEqual([4, 5])
  expect(blockersInBody('Blocked by: #3, #6')).toEqual([3, 6])
  expect(firstSentence(aboutOf(BODY4))).toBe('Les deux scripts qui relient Claude Code au catalogue.')
  expect(aboutOf('# 02: X\n\n**What to build:** Le bot enregistre la matinée.\n\n**Blocked by:** None\n')).toBe('Le bot enregistre la matinée.')
})

test('Ticket statut : un /build-ticket fait passer de « Tickets du projet » à « Ticket en cours »', async ($, on) => {
  engine(on)
  on('skill.prompt', (_: unknown, e: { text: string }) => ({ text: e.text }))
  on('tool.call', () => ({ result: { stdout: 'worktree=/p/.worktrees/ticket-4\nbranch=ticket/4-import\nbase=origin/main', stderr: '', interrupted: false } }))
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'ticket-statut', args: 'projet' } as never)
  await $.command.run({ command: 'ticket-statut', args: 'projet' } as never)
  {
    const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await pane.find({ type: 'Text', text: /À faire maintenant/ })).toBeTruthy()
    await pane.unmount()
  }
  await $.skill.prompt({ skill: 'an-forge:build-ticket', text: 'Build ticket' })
  await $.tool.call({ tool: 'Bash', command: 'skills/build-ticket/scripts/start-ticket.sh --new 4 "Import et export"' } as never)
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /⚒ Ticket en cours · #4/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /Isoler/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /À faire maintenant/ })).toBeFalsy()
  // L'onglet ramène aux tickets du projet.
  await pane.press({ key: 'tab-board' })
  expect(await pane.find({ type: 'Text', text: /À faire maintenant/ })).toBeTruthy()
  await pane.unmount()
})

test('/an-forge ticket status ouvre le même panneau', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/p', surface: 'terminal', isInteractive: true })
  expect(JSON.stringify(await $.command.run({ command: 'an-forge', args: 'ticket status projet' } as never))).toMatch(/tickets du projet/)
  expect(JSON.stringify(await $.command.run({ command: 'an-forge', args: 'ticket statut en-cours' } as never))).toMatch(/ticket en cours/)
  expect(JSON.stringify(await $.command.run({ command: 'an-forge', args: 'build-ticket' } as never))).toMatch(/Usage/)
})
