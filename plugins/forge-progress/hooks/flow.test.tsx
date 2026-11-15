import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'forge-progress',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: true, maxRows: 4, bodyColumns: 140, scroll: { offset: 0, bodyRows: 4 }, view: {} },
} as const

const PANE = {
  plugin: 'forge-progress',
  component: 'Pane',
  requestId: 'forge-progress',
  props: {
    title: 'an-forge',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

// Ce que les scripts d'an-forge affichent, par commande.
const OUTPUT: [RegExp, string][] = [
  [/start-ticket\.sh/, 'worktree=/p.worktrees/ticket-12\nbranch=ticket/12-profil-de-gouts\nbase=origin/main\nstatus=created'],
  [/pick-model\.sh/, 'build=sonnet\nreview=opus'],
  [/gate\.sh/, 'GATE: PASS (12s) — sortie complète : /tmp/gate.log'],
  [/gh pr create/, 'https://github.com/arthur/recipe/pull/34'],
  [/pr-checks\.sh/, 'checks=ok'],
]

test('un /build-ticket avance de la réservation à la décision', async ($, on) => {
  on('command.register', () => ({ value: { command: 'ticket-statut' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('skill.prompt', (_, e) => ({ text: e.text }))
  on('tool.call', (_, e) => {
    const cmd = (e as { command?: string }).command ?? ''
    const out = OUTPUT.find(([re]) => re.test(cmd))?.[1] ?? ''
    return { result: { stdout: out, stderr: '', interrupted: false } }
  })

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.skill.prompt({ skill: 'an-forge:build-ticket', text: 'Build ticket' })
  await $.tool.call({ tool: 'Bash', command: 'skills/build-ticket/scripts/start-ticket.sh --new 12 "Profil de goûts"' })
  await $.tool.call({ tool: 'Bash', command: 'skills/build-ticket/scripts/pick-model.sh petit' })
  await $.tool.call({ tool: 'Bash', command: 'cd /p.worktrees/ticket-12 && scripts/gate.sh origin/main' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect((await ui.find({ type: 'Text', text: /#12 Profil de goûts/ }))?.text).toBe('#12 Profil de goûts')
    expect((await ui.find({ type: 'Text', text: /^Tester$/ }))?.text).toBe('Tester')
    await ui.unmount()
  }

  await $.tool.call({ tool: 'Bash', command: 'gh pr create --title "x" --body "y"' })
  await $.tool.call({ tool: 'Bash', command: 'scripts/pr-checks.sh 34 --wait' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^Ta décision$/ }))?.text).toBe('Ta décision')
  await ui.unmount()

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /PR #34 ouverte/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /Checks GitHub : verts/ })).toBeTruthy()
  await pane.unmount()
})

test('sans flux, la barre laisse la place', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /engine/ }))?.text).toBe('engine')
  await ui.unmount()
})

test('une commande qui enchaîne plusieurs scripts les compte tous', async ($, on) => {
  on('command.register', () => ({ value: { command: 'ticket-statut' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({
    result: { stdout: 'brief ok\nhttps://github.com/arthur/recipe/pull/34\nchecks=ok', stderr: '', interrupted: false },
  }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Bash', command: 'scripts/start-ticket.sh --new 7 "Recherche"' })
  await $.tool.call({ tool: 'Bash', command: 'python3 render.py && gh pr create --title t && scripts/pr-checks.sh 34 --wait' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^Ta décision$/ }))?.text).toBe('Ta décision')
  await ui.unmount()
})

test("dans « a && b », si a échoue, b n'est pas compté", async ($, on) => {
  on('command.register', () => ({ value: { command: 'ticket-statut' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  let next: { stdout: string; isError: boolean } = { stdout: '', isError: false }
  on('tool.call', () => ({ result: { stdout: next.stdout, stderr: '', interrupted: false }, ...(next.isError ? { isError: true as const } : {}) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  next = { stdout: 'branch=ticket/7-recherche\nstatus=created', isError: false }
  await $.tool.call({ tool: 'Bash', command: 'scripts/start-ticket.sh --new 7 "Recherche"' })

  // Le gate échoue : la PR n'est pas créée.
  next = { stdout: 'GATE: FAIL (8s) — sortie complète : /tmp/gate.log', isError: true }
  await $.tool.call({ tool: 'Bash', command: 'scripts/gate.sh origin/main && gh pr create --title t' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^Tester · essai 2$/ }))?.text).toBe('Tester · essai 2')
  await ui.unmount()

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /ouverte/ })).toBeFalsy()
  await pane.unmount()
})

test('une chaîne qui échoue à la fin garde ce qui a réussi avant', async ($, on) => {
  on('command.register', () => ({ value: { command: 'ticket-statut' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  let next: { stdout: string; isError: boolean } = { stdout: '', isError: false }
  on('tool.call', () => ({ result: { stdout: next.stdout, stderr: '', interrupted: false }, ...(next.isError ? { isError: true as const } : {}) }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  next = { stdout: 'branch=ticket/7-recherche\nstatus=created', isError: false }
  await $.tool.call({ tool: 'Bash', command: 'scripts/start-ticket.sh --new 7 "Recherche"' })

  // La PR est créée, puis pr-checks plante avant d'afficher quoi que ce soit.
  next = { stdout: 'https://github.com/arthur/recipe/pull/34\nerreur réseau', isError: true }
  await $.tool.call({ tool: 'Bash', command: 'gh pr create --title t && scripts/pr-checks.sh 34 --wait' })

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /PR #34 ouverte/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /Checks GitHub :/ })).toBeFalsy()
  await pane.unmount()
})

test('/ticket-statut demo remplit la barre avec un faux ticket', async ($, on) => {
  on('command.register', () => ({ value: { command: 'ticket-statut' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('clock.after', () => ({ value: { cancel: () => {} } }) as never)
  on('clock.every', () => ({ value: { cancel: () => {} } }) as never)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  const ran = await $.command.run({ command: 'ticket-statut', args: 'demo' } as never)
  expect(JSON.stringify(ran)).toMatch(/Démo lancée/)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /#12 Démo : profil de goûts/ })).toBeTruthy()
  expect(await ui.find({ type: 'Text', text: /▐▛█▜▌⚒/ })).toBeTruthy()
  await ui.unmount()
})

test('chaque sous-agent a sa carte, avec son Clawd et ce qu’il fait', async ($, on) => {
  on('command.register', () => ({ value: { command: 'ticket-statut' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: 'a1' }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.agent.spawn({ tool_use_id: 't1', prompt: '…', description: 'Miniatures', subagentType: 'general-purpose', parentModel: 'claude-opus-5-5', background: false, fork: false } as never)
  await $.tool.call({ tool: 'Read', file_path: '/p/research.md', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Grep', pattern: 'thumbnail', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Write', file_path: '/p/thumbnails.md', content: 'x', agentId: 'a1' } as never)
  await $.command.run({ command: 'ticket-statut', args: 'en-cours' } as never)

  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await pane.find({ type: 'Text', text: /^Miniatures$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /Étape 3 · Écrit thumbnails\.md/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^Cherche « thumbnail »$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /^Lit research\.md$/ })).toBeTruthy()
  expect(await pane.find({ type: 'Text', text: /En cours · 1/ })).toBeTruthy()
  expect(await pane.find({ type: 'Raster', key: 'clawd-a1' } as never)).toBeTruthy()
  await pane.unmount()
})
