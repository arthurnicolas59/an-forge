import { expect, test } from 'claude-code/testing'

declare const console: { log: (text: string) => void }

const BAND = {
  plugin: 'forge-progress',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 4, bodyColumns: 140, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const

const PANE = {
  plugin: 'forge-progress',
  component: 'Pane',
  requestId: 'forge-progress',
  props: { title: 'Ticket statut', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} },
} as const

test('un /build-ticket complet, étape par étape', async ($, on) => {
  on('command.register', () => ({ value: { command: 'ticket-statut' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  let out = ''
  let isError = false
  on('tool.call', () => ({ result: { stdout: out, stderr: '', interrupted: false }, ...(isError ? { isError: true as const } : {}) }))
  let n = 0
  on('agent.spawn', () => ({ model: 'claude-sonnet-5-5', agentId: `agent-${++n}` }))

  const bash = async (command: string, stdout: string, err = false) => {
    out = stdout
    isError = err
    await $.tool.call({ tool: 'Bash', command })
  }
  const spawn = (description: string, subagentType = 'general-purpose') =>
    $.agent.spawn({ tool_use_id: `t${n}`, prompt: '…', description, subagentType, parentModel: 'claude-opus-5-5', background: false, fork: false } as never)
  const bandSays = async (re: RegExp) => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const found = await ui.find({ type: 'Text', text: re })
    await ui.unmount()
    return found?.text
  }

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.skill.prompt({ skill: 'an-forge:build-ticket', text: 'Build ticket' })

  await bash('skills/build-ticket/scripts/tickets.sh next', '12\tProfil de goûts')
  await bash('skills/build-ticket/scripts/start-ticket.sh --new 12 "Profil de goûts"',
    'worktree=/p.worktrees/ticket-12\nbranch=ticket/12-profil-de-gouts\nbase=origin/main\nstatus=created')
  expect(await bandSays(/^Isoler$/)).toBe('Isoler')
  expect(await bandSays(/#12 Profil de goûts/)).toBe('#12 Profil de goûts')

  await bash('skills/build-ticket/scripts/pick-model.sh moyen', 'build=sonnet\nreview=opus')
  await bash('skills/before-after/scripts/capture.sh http://localhost:3000 avant.png', 'Capture enregistrée : avant.png')
  expect(await bandSays(/^Captures avant$/)).toBe('Captures avant')

  await spawn('Construire le ticket #12')
  expect(await bandSays(/^Construire$/)).toBe('Construire')
  // Dans la barre, le mini-Clawd tape sur l'enclume.
  expect(await bandSays(/▐▛█▜▌⚒/)).toBe('▐▛█▜▌⚒')
  // Dans le panneau, les cases coût/tokens/temps sont là dès le début.
  {
    const p = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await p.find({ type: 'Text', text: /^Coût total$/ })).toBeTruthy()
    await p.unmount()
  }

  await bash('cd /p.worktrees/ticket-12 && scripts/gate.sh origin/main', 'GATE: FAIL (14s) — sortie complète : /tmp/gate.log', true)
  expect(await bandSays(/^Tester · essai 2$/)).toBe('Tester · essai 2')
  await bash('cd /p.worktrees/ticket-12 && scripts/gate.sh origin/main', 'GATE: PASS (12s) — sortie complète : /tmp/gate.log')
  expect(await bandSays(/^Tester$/)).toBe('Tester')

  await spawn('Relecture standards', 'code-review')
  await spawn('Revue des risques', 'risk-review')
  expect(await bandSays(/^Relire · tour 1$/)).toBe('Relire · tour 1')

  await bash('skills/before-after/scripts/capture.sh http://localhost:3000 apres.png', 'Capture enregistrée : apres.png')
  expect(await bandSays(/^Captures après$/)).toBe('Captures après')
  await bash('python3 skills/feature-brief/scripts/render.py brief.md', 'brief.html')
  expect(await bandSays(/^Brief$/)).toBe('Brief')

  await bash('gh pr create --title "Profil de goûts" --body-file brief.md', 'https://github.com/arthur/recipe/pull/34')
  expect(await bandSays(/^PR$/)).toBe('PR')
  await bash('scripts/pr-checks.sh 34 --wait', 'checks=ok\npreview=https://recipe-pr-34.vercel.app')
  expect(await bandSays(/^Ta décision$/)).toBe('Ta décision')

  // Le panneau, juste avant le merge.
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const lines: string[] = []
  for (const t of await pane.findAll({ type: 'Text' })) {
    const s = t.text.trimEnd()
    if (s && !lines.some(l => l.includes(s))) lines.push(s)
  }
  console.log('\n──── Ticket statut ────\n' + lines.join('\n') + '\n────────────────────────')
  expect(await pane.find({ type: 'Text', text: /PR #34 ouverte/ })).toBeTruthy()
  // Clawd attend la décision, un point d'interrogation au-dessus de la tête.
  expect(await pane.find({ type: 'Raster', key: 'clawd' } as never)).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /Gate : FAIL \(1\/3\)/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /Gate : PASS/ })).toBeTruthy()
  await pane.unmount()

  await bash('scripts/merge-pr.sh 34', 'MERGÉE : PR #34')
  const after = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await after.find({ type: 'Text', text: /PR #34 mergée/ })).toBeTruthy()
  // Merge : Clawd lève les bras.
  expect(await after.find({ type: 'Raster', key: 'clawd' } as never)).toBeTruthy()
  await after.unmount()
})
