import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AgentRun, Board, BoardTicket, Flow, FlowKind, FlowStatus, LogEntry, TicketState, View } from '../types'
import { countOf, firstSentence, loadBoard, nextSteps } from './board'

// forge-progress : suit le workflow an-forge en direct, sans rien demander aux skills.
// Il reconnaît les skills lancés (skill.prompt), les scripts d'an-forge passés par Bash
// (start-ticket.sh, gate.sh, pr-checks.sh, merge-pr.sh…) et les sous-agents.

const P = 'forge-progress'
const flow = atom({ plugin: 'forge-progress', key: 'flow' } as const, null, { shape: 'flow-1' })
const agents = atom({ plugin: 'forge-progress', key: 'agents' } as const, [], { shape: 'agents-1' })
const now = atom({ plugin: 'forge-progress', key: 'now' } as const, 0)
const frame = atom({ plugin: 'forge-progress', key: 'frame' } as const, 0)
const board = atom({ plugin: 'forge-progress', key: 'board' } as const, null, { shape: 'board-1' })
const boardLoading = atom({ plugin: 'forge-progress', key: 'boardLoading' } as const, false)
const view = atom({ plugin: 'forge-progress', key: 'view' } as const, 'board' as View)
const opened = atom({ plugin: 'forge-progress', key: 'opened' } as const, null as string | null)
const goals = atom({ plugin: 'forge-progress', key: 'goals' } as const, {} as Record<string, string>, { shape: 'goals-1' })

const PANE = 'forge-progress'
const PANE_TITLE = 'Ticket statut'
const COMMAND = 'ticket-statut'
// Le même panneau en version longue : /an-forge ticket status (ou statut). Les skills
// d'an-forge s'appellent an-forge:<nom>, donc le nom seul « an-forge » reste libre.
const LONG_COMMAND = 'an-forge'
const LONG_PREFIX = /^ticket[\s-]+stat(?:us|ut)\b\s*/i
const ACCENT = '#f59e0b'
const OK = '#3B9C5F'
const KO = '#D0453F'
const INFO = '#2563eb'
const MAX_LOG = 40
const CLAWD = '#D97757'
const FRAME_MS = 350

// ---------------------------------------------------------------------------
// Clawd, la mascotte de Claude Code, dessiné en blocs. Son humeur suit le flux.

type Mood = 'work' | 'worry' | 'think' | 'party' | 'sleep'

const moodOf = (f: Flow): Mood => {
  if (f.status === 'merged' || f.status === 'done') return 'party'
  if (f.status === 'stopped') return 'sleep'
  if (f.status === 'waiting' || f.status === 'needs-info') return 'think'
  if (f.kind === 'build' && f.gateLast === 'fail' && f.stage === 3) return 'worry'
  return 'work'
}

const BODY = '▝▜█████▛▘'
const LEGS = '  ▘▘ ▝▝'
const STEP = '  ▝▘ ▝▘'

const SPRITES: Record<Mood, readonly (readonly [string, string, string])[]> = {
  // Il tape sur l'enclume, des étincelles partent, ses pattes bougent.
  work: [
    [' ▐▛███▜▌ ⚒', BODY, LEGS],
    [' ▐▛███▜▌', BODY + '⚒', STEP + '  ✦'],
    [' ▐▛███▜▌ ⚒', BODY, STEP],
    [' ▐▛███▜▌', BODY + '⚒', LEGS + '  ·'],
  ],
  // Le gate a échoué : une goutte de sueur coule.
  worry: [
    [' ▐▛███▜▌ ,', BODY, LEGS],
    [' ▐▛███▜▌', BODY + ',', LEGS],
    [' ▐▛███▜▌', BODY, LEGS + '  ,'],
    [' ▐▛███▜▌', BODY, LEGS],
  ],
  // Il attend ta décision : il cligne des yeux, un point d'interrogation flotte.
  think: [
    [' ▐▛███▜▌ ?', BODY, LEGS],
    [' ▐▛███▜▌  ?', BODY, LEGS],
    [' ▐▛███▜▌ ?', BODY, LEGS],
    [' ▐▀███▀▌  ?', BODY, LEGS],
  ],
  // La PR est mergée : il saute, bras en l'air.
  party: [
    ['▝▐▛███▜▌▘ ✦', ' ▐█████▌', LEGS],
    [' ▐▛███▜▌   ·', BODY, '  ▝▝ ▘▘ ✦'],
    ['▝▐▛███▜▌▘  *', ' ▐█████▌', LEGS],
    [' ▐▛███▜▌ ✦', BODY, '  ▝▝ ▘▘'],
  ],
  // Arrêté en route : il dort.
  sleep: [
    [' ▐▀███▀▌ z', BODY, LEGS],
    [' ▐▀███▀▌ z', BODY, LEGS],
    [' ▐▀███▀▌  Z', BODY, LEGS],
    [' ▐▀███▀▌  Z', BODY, LEGS],
  ],
}

const MINI: Record<Mood, readonly string[]> = {
  work: ['▐▛█▜▌⚒', '▐▛█▜▌✦', '▐▛█▜▌⚒', '▐▛█▜▌·'],
  worry: ['▐▛█▜▌,', '▐▛█▜▌ ', '▐▛█▜▌,', '▐▛█▜▌ '],
  think: ['▐▛█▜▌?', '▐▛█▜▌?', '▐▛█▜▌ ', '▐▀█▀▌?'],
  party: ['▐▛█▜▌✦', '▐▛█▜▌*', '▐▛█▜▌✦', '▐▛█▜▌·'],
  sleep: ['▐▀█▀▌z', '▐▀█▀▌z', '▐▀█▀▌Z', '▐▀█▀▌Z'],
}

// ---------------------------------------------------------------------------
// Clawd en pixel art, dessiné dans un Raster : chaque case porte deux pixels
// (haut et bas, avec ▀ ▄ ou un fond plein), donc pas de bandes entre les lignes.

const PIX: Record<string, number> = {
  e: 0x1f1f1f, // yeux
  m: 0xb8bec7, // tête du marteau
  h: 0x8b5a2b, // manche
  s: 0xfde047, // étincelle
  w: 0x60a5fa, // goutte de sueur
  q: 0xe5e7eb, // « ? » et « z »
}
const DEFAULT_COLOR = 0x01000000

const hex = (c: string): number => parseInt(c.replace('#', ''), 16)

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const base64 = (bytes: Uint8Array): string => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (b === undefined ? '=' : B64[(n >> 6) & 63]!) + (c === undefined ? '=' : B64[n & 63]!)
  }
  return out
}

// Des lignes de pixels (« . » transparent, « X » le corps, les autres lettres PIX)
// en cases de Raster ; `scale` agrandit chaque pixel.
const rasterOf = (grid: readonly string[], body: number, scale = 1): { columns: number; rows: number; cells: string } => {
  const px = grid.flatMap(row => {
    const wide = [...row].flatMap(ch => Array(scale).fill(ch) as string[]).join('')
    return Array(scale).fill(wide) as string[]
  })
  if (px.length % 2) px.push('')
  const columns = Math.max(...px.map(r => r.length))
  const rows = px.length / 2
  const color = (ch: string | undefined): number | null => (!ch || ch === '.' ? null : ch === 'X' ? body : (PIX[ch] ?? body))
  const words = new Uint32Array(columns * rows * 3)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      const top = color(px[2 * r]?.[c])
      const bot = color(px[2 * r + 1]?.[c])
      let cp = 0x20, fg = DEFAULT_COLOR, bg = DEFAULT_COLOR
      if (top !== null && bot !== null && top === bot) bg = top
      else if (top !== null && bot !== null) { cp = 0x2580; fg = top; bg = bot }
      else if (top !== null) { cp = 0x2580; fg = top }
      else if (bot !== null) { cp = 0x2584; fg = bot }
      const k = (r * columns + c) * 3
      words[k] = cp
      words[k + 1] = fg
      words[k + 2] = bg
    }
  }
  return { columns, rows, cells: base64(new Uint8Array(words.buffer)) }
}

// Le corps de Clawd : 11 pixels de large, 8 de haut.
const HEAD = ['..XXXXXXX..', '..XeXXXeX..', '..XeXXXeX..']
const HEAD_BLINK = ['..XXXXXXX..', '..XXXXXXX..', '..XeXXXeX..']
const ARMS = ['XXXXXXXXXXX', 'XXXXXXXXXXX', '..XXXXXXX..']
const LEGS_A = ['..X.X.X.X..', '..X.X.X.X..']
const LEGS_B = ['..X.X.X.X..', '.X.X...X.X.']
const PARTY = ['X.XXXXXXX.X', 'X.XeXXXeX.X', 'XXXeXXXeXXX', '..XXXXXXX..', '..XXXXXXX..', '..XXXXXXX..']

// Ajoute à droite de chaque ligne quatre pixels d'accessoires.
const withSide = (body: readonly string[], side: readonly string[]): string[] =>
  body.map((row, i) => row + (side[i] ?? '....'))
const up = (rows: readonly string[]): string[] => [...rows.slice(1), '.'.repeat(rows[0]?.length ?? 0)]

const BIG: Record<Mood, readonly (readonly string[])[]> = {
  work: [
    withSide([...HEAD, ...ARMS, ...LEGS_A], ['mmm.', 'mmm.', '.h..', 'h...']),
    withSide([...HEAD, ...ARMS, ...LEGS_B], ['....', '....', '....', 'hhmm', '..mm', '.s..', 's.s.', '....']),
    withSide([...HEAD, ...ARMS, ...LEGS_B], ['mmm.', 'mmm.', '.h..', 'h...']),
    withSide([...HEAD, ...ARMS, ...LEGS_A], ['....', '....', '....', 'hhmm', '..mm', 's...', '.s.s', '....']),
  ],
  worry: [
    withSide([...HEAD, ...ARMS, ...LEGS_A], ['w...', 'w...']),
    withSide([...HEAD, ...ARMS, ...LEGS_A], ['....', 'w...', 'w...']),
    withSide([...HEAD, ...ARMS, ...LEGS_A], ['....', '....', 'w...', 'w...']),
    withSide([...HEAD, ...ARMS, ...LEGS_A], []),
  ],
  think: [
    withSide([...HEAD, ...ARMS, ...LEGS_A], ['.qqq', '...q', '..qq', '....', '..q.']),
    withSide([...HEAD, ...ARMS, ...LEGS_A], ['....', '.qqq', '...q', '..qq', '....', '..q.']),
    withSide([...HEAD, ...ARMS, ...LEGS_A], ['.qqq', '...q', '..qq', '....', '..q.']),
    withSide([...HEAD_BLINK, ...ARMS, ...LEGS_A], ['....', '.qqq', '...q', '..qq', '....', '..q.']),
  ],
  party: [
    withSide([...PARTY, ...LEGS_A], ['.s..', '...s', '....', '..s.']),
    up(withSide([...PARTY, ...LEGS_B], ['....', '..s.', 's...', '....', '...s'])),
    withSide([...PARTY, ...LEGS_A], ['...s', '.s..', '....', '....', 's...']),
    up(withSide([...PARTY, ...LEGS_B], ['s...', '....', '..s.', '.s..'])),
  ],
  sleep: [
    withSide([...HEAD_BLINK, ...ARMS, ...LEGS_A], ['.qqq', '..q.', '.qqq']),
    withSide([...HEAD_BLINK, ...ARMS, ...LEGS_A], ['.qqq', '..q.', '.qqq']),
    withSide([...HEAD_BLINK, ...ARMS, ...LEGS_A], ['....', '.qqq', '..q.', '.qqq']),
    withSide([...HEAD_BLINK, ...ARMS, ...LEGS_A], ['....', '.qqq', '..q.', '.qqq']),
  ],
}

// Une barre pleine en pixels : rempli dans la couleur du flux, le reste en gris.
const solidBar = (r: number, width: number): string => {
  const n = Math.round(width * r)
  return 'X'.repeat(n) + 'k'.repeat(Math.max(0, width - n))
}

// Petit Clawd qui tape au clavier, à côté de l'étape en cours.
PIX.k = 0x4b5563
PIX.K = 0xfde047

// Clawd d'agent : il marche tant que l'agent tourne.
const AGENT_PX = {
  running: [[...HEAD, ...ARMS, ...LEGS_A], [...HEAD, ...ARMS, ...LEGS_B]],
  done: [[...HEAD, ...ARMS, ...LEGS_A]],
  failed: [[...HEAD_BLINK, ...ARMS, ...LEGS_A]],
} as const

// Mémo : une grille et une couleur donnent toujours les mêmes cases.
const rasterMemo = new Map<string, { columns: number; rows: number; cells: string }>()
const raster = (grid: readonly string[], body: string, scale = 1) => {
  const k = `${body}|${scale}|${grid.join('/')}`
  let r = rasterMemo.get(k)
  if (!r) {
    r = rasterOf(grid, hex(body), scale)
    if (rasterMemo.size > 400) rasterMemo.clear()
    rasterMemo.set(k, r)
  }
  return r
}

const pick = <T,>(frames: readonly T[], n: number): T => frames[((n % frames.length) + frames.length) % frames.length] as T

// Il bouge tant que le flux vit, et fête un merge quelques secondes.
const isAnimated = (f: Flow | null, at: number): boolean =>
  !!f && (!isFinished(f) ? f.status !== 'stopped' : at - (f.endedAt ?? 0) < 12_000)

// ---------------------------------------------------------------------------
// Les étapes, telles que le README d'an-forge les nomme.

const STAGES: Record<FlowKind, readonly string[]> = {
  build: ['Isoler', 'Captures avant', 'Construire', 'Tester', 'Relire', 'Captures après', 'Brief', 'PR', 'Checks GitHub', 'Ta décision'],
  launch: ['Interrogatoire', 'Spec', 'Tickets', 'Prêt'],
  quick: ['Questions', 'Ticket', 'Prêt'],
}

const B = { isoler: 0, avant: 1, construire: 2, tester: 3, relire: 4, apres: 5, brief: 6, pr: 7, checks: 8, decision: 9 } as const
const L = { grill: 0, spec: 1, tickets: 2, pret: 3 } as const
const Q = { questions: 0, ticket: 1, pret: 2 } as const

const KIND_LABEL: Record<FlowKind, string> = { build: 'build-ticket', launch: 'project-launch', quick: 'quick-ticket' }

const isFinished = (f: Flow): boolean => f.status === 'merged' || f.status === 'done'

const blank = (kind: FlowKind, at: number, title = ''): Flow => ({
  kind,
  stage: 0,
  furthest: 0,
  status: 'running',
  title: title || (kind === 'build' ? 'Ticket' : kind === 'launch' ? 'Cadrage' : 'Petit ticket'),
  gatePass: 0,
  gateFail: 0,
  reviewRound: 0,
  issues: [],
  startedAt: at,
  log: [],
})

const ratio = (f: Flow): number => {
  if (isFinished(f)) return 1
  const n = STAGES[f.kind].length
  return Math.min(1, f.furthest / n)
}

const stageName = (f: Flow): string => STAGES[f.kind][f.stage] ?? ''

const statusWord = (f: Flow): string => {
  switch (f.status) {
    case 'merged':
      return 'Mergé'
    case 'done':
      return 'Terminé'
    case 'needs-info':
      return 'Question posée'
    case 'stopped':
      return 'Arrêté'
    case 'waiting':
      return 'À toi de décider'
    default:
      return ''
  }
}

// Ce que la barre dit de l'étape en cours : « Relire · tour 2 », « Tester · 2e essai ».
const stageLabel = (f: Flow): string => {
  const word = statusWord(f)
  if (word && f.status !== 'waiting') return word
  const name = stageName(f)
  if (f.kind === 'build') {
    if (f.stage === B.tester && f.gateFail > 0 && f.gateLast !== 'pass') return `${name} · essai ${f.gateFail + 1}`
    if (f.stage === B.relire && f.reviewRound > 0) return `${name} · tour ${f.reviewRound}`
    if (f.stage === B.checks && f.checks === 'pending') return `${name} · en cours`
  }
  return name
}

const tone = (f: Flow): string =>
  f.status === 'merged' || f.status === 'done' ? OK : f.status === 'stopped' || f.status === 'needs-info' ? KO : ACCENT

// ---------------------------------------------------------------------------
// Petits outils.

const clip = (s: string, max: number): string => (s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s)

const fmtTime = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

const fmtClock = (at: number): string => {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const fmtTokens = (n: number): string =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`

const fmtCost = (usd: number): string => `$${usd < 10 ? usd.toFixed(2) : usd.toFixed(1)}`

const bar = (r: number, width: number): string => {
  const filled = Math.round(width * r)
  return '▰'.repeat(filled) + '▱'.repeat(Math.max(0, width - filled))
}

const EMPTY_BAR = '#3a3a3a'
const DONE_DETAIL = '#8a9a8f'

const modelName = (id: string): string => {
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2})(?!\d))?/i.exec(id)
  const [, family = '', major = '', minor] = m ?? []
  if (!family) return id.replace(/^claude-/, '').replace(/\[.*\]$/, '') || '—'
  return `${family.charAt(0).toUpperCase()}${family.slice(1).toLowerCase()} ${major}${minor ? '.' + minor : ''}`
}

// Prix catalogue en USD par million de tokens : entrée, sortie, lecture cache, écriture cache.
// Une estimation, pas une facture.
type Price = [number, number, number, number]
const PRICES: [RegExp, Price][] = [
  [/fable|mythos/, [10, 50, 1, 20]],
  [/opus-5-5/, [4, 20, 0.2, 8]],
  [/opus/, [5, 25, 0.5, 10]],
  [/sonnet-5/, [2, 10, 0.2, 4]],
  [/sonnet/, [3, 15, 0.3, 6]],
  [/haiku-5-5/, [0.1, 0.5, 0.01, 0.2]],
  [/haiku/, [1, 5, 0.1, 2]],
]

type Usage = {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

const tokensOf = (u: Usage): number =>
  (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0)

const costOf = (model: string, u: Usage): number => {
  const [i, o, r, w] = PRICES.find(([re]) => re.test(model.toLowerCase()))?.[1] ?? [4, 20, 0.2, 8]
  return (
    ((u.input_tokens || 0) * i +
      (u.output_tokens || 0) * o +
      (u.cache_read_input_tokens || 0) * r +
      (u.cache_creation_input_tokens || 0) * w) /
    1e6
  )
}

// Le texte qu'une commande Bash a rendu, quelle que soit la forme du résultat.
const outputOf = (ran: unknown): string => {
  if (!ran || typeof ran !== 'object') return ''
  const r = ran as { result?: unknown; text?: unknown }
  const parts: string[] = []
  if (typeof r.text === 'string') parts.push(r.text)
  const res = r.result
  if (typeof res === 'string') parts.push(res)
  else if (res && typeof res === 'object') {
    const o = res as { stdout?: unknown; stderr?: unknown }
    if (typeof o.stdout === 'string') parts.push(o.stdout)
    if (typeof o.stderr === 'string') parts.push(o.stderr)
  }
  return parts.join('\n')
}

// Ce que chaque script affiche quand il a tourné.
const SIGNATURES: [RegExp, RegExp][] = [
  [/\bstart-ticket\.sh\b/, /^branch=/m],
  [/\btickets\.sh\b/, /^taille=|^\d+\t/m],
  [/\bpick-model\.sh\b/, /^build=/m],
  [/\bgate\.sh\b/, /GATE:/],
  [/\bgh pr create\b/, /https:\/\/github\.com\/\S+\/pull\/\d+/],
  [/\bgh issue create\b/, /\/issues\/\d+/],
  [/\bcapture\.sh\b/, /Capture enregistrée/],
  [/\bpr-checks\.sh\b/, /^checks=|backgroundTaskId/m],
  [/\bmerge-pr\.sh\b/, /MERGÉE|PAS À JOUR|GATE À RELANCER|CHECKS EN|n'est pas ouverte/],
  [/\bflag-ticket\.sh\b/, /Ticket #\d+ :/],
]

const kv = (out: string, key: string): string | undefined => {
  const m = new RegExp(`^${key}=(.*)$`, 'm').exec(out)
  return m?.[1]?.trim() || undefined
}

const titleFromBranch = (branch: string): string => {
  const slug = branch.replace(/^ticket\/\d+-?/, '')
  const t = slug.replace(/-/g, ' ').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : ''
}

const bareSkill = (name: string): string => name.replace(/^.*:/, '')

// ---------------------------------------------------------------------------
// Faire avancer le flux.

type Change = (f: Flow) => Flow

const log = (text: string, at: number, t?: LogEntry['tone']): Change => f => ({
  ...f,
  log: [...f.log, { at, text, tone: t }].slice(-MAX_LOG),
})

// Va à une étape. La barre ne recule jamais : une reprise (re-tester après une
// relecture) change l'étape en cours, pas le chemin déjà fait.
const goTo = (stage: number): Change => f => ({
  ...f,
  stage,
  furthest: Math.max(f.furthest, stage),
  status: f.status === 'stopped' || f.status === 'needs-info' ? 'running' : f.status,
})

const pipe =
  (...changes: Change[]): Change =>
  f =>
    changes.reduce((acc, c) => c(acc), f)

async function change($: EngineInterface, kind: FlowKind | null, c: Change): Promise<Flow | null> {
  return update($, flow, prev => {
    if (!prev) return prev
    if (kind && prev.kind !== kind) return prev
    return c(prev)
  })
}

// Ouvre un flux ; true quand il est neuf.
async function start($: EngineInterface, kind: FlowKind, at: number, text: string): Promise<boolean> {
  let isNew = false
  await update($, flow, prev => {
    // Un flux du même type déjà en cours continue (une reprise, un skill relancé).
    if (prev && prev.kind === kind && !isFinished(prev)) return prev
    isNew = true
    return log(text, at, 'info')(blank(kind, at))
  })
  if (isNew) stopDemo()
  if (isNew && kind === 'build') await update($, agents, list => list.filter(a => a.status === 'running'))
  return isNew
}

// ---------------------------------------------------------------------------
// Panneau.

/** Ouvre le panneau Ticket statut, sur la fenêtre demandée. */
async function openPane($: EngineInterface, mode?: View): Promise<void> {
  if (mode) await update($, view, () => mode)
  if (mode === 'board') void refreshBoard($)
  await update($, now, () => Date.now())
  await $.ui.open({ id: PANE, title: PANE_TITLE })
}

// ---------------------------------------------------------------------------
// /ticket-statut demo : un faux /build-ticket qui défile, pour voir la barre, le panneau et Clawd.

let demoTimers: { cancel: () => void }[] = []

const stopDemo = (): void => {
  for (const t of demoTimers) t.cancel()
  demoTimers = []
}

async function playDemo($: EngineInterface): Promise<void> {
  stopDemo()
  const t0 = Date.now()
  await update($, agents, () => [])
  await update($, flow, () => ({
    ...blank('build', t0, 'Démo : profil de goûts'),
    ticket: 12,
    branch: 'ticket/12-profil-de-gouts',
    taille: 'moyen',
    buildModel: 'sonnet',
    reviewModel: 'opus',
    log: [{ at: t0, text: 'Démo lancée (rien n’est envoyé à GitHub)', tone: 'info' as const }],
  }))
  await update($, now, () => t0)

  const agent = (id: string, role: string, description: string) => (list: AgentRun[]): AgentRun[] => [
    ...list,
    { id, agentId: id, role, type: 'general-purpose', description, model: role === 'constructeur' ? 'claude-sonnet-5-5' : 'claude-opus-5-5', status: 'running', startedAt: Date.now(), tokens: 0, costUsd: 0, steps: 0 },
  ]
  const finish = (id: string, tokens: number, costUsd: number) => (list: AgentRun[]): AgentRun[] =>
    list.map(a => (a.id === id ? { ...a, status: 'done', endedAt: Date.now(), tokens, costUsd, steps: 12 } : a))
  const step = (text: string, stage: number, extra: Partial<Flow> = {}, tone?: LogEntry['tone']) => async () => {
    await change($, 'build', g => pipe(goTo(stage), log(text, Date.now(), tone))({ ...g, ...extra }))
  }

  const script: [number, () => Promise<unknown>][] = [
    [4, step("Captures de l'avant", B.avant)],
    [4, async () => {
      await update($, agents, agent('demo-build', 'constructeur', 'Construire le ticket #12'))
      await step('Constructeur lancé (Sonnet 5.5)', B.construire)()
    }],
    [7, step('Gate : FAIL (1/3)', B.tester, { gateFail: 1, gateLast: 'fail' }, 'ko')],
    [6, async () => {
      await update($, agents, finish('demo-build', 184_000, 1.42))
      await step('Gate : PASS', B.tester, { gateFail: 0, gatePass: 1, gateLast: 'pass' }, 'ok')()
    }],
    [4, async () => {
      await update($, agents, agent('demo-std', 'relecteur', 'Relecture standards'))
      await update($, agents, agent('demo-risk', 'risques', 'Revue des risques'))
      await step('Relectures, tour 1', B.relire, { reviewRound: 1 })()
    }],
    [6, async () => {
      await update($, agents, finish('demo-std', 62_000, 0.71))
      await update($, agents, finish('demo-risk', 48_000, 0.55))
      await step("Captures de l'après", B.apres)()
    }],
    [4, step('Brief rendu', B.brief)],
    [4, step('PR #34 ouverte', B.pr, { pr: 34, prUrl: 'https://github.com/exemple/demo/pull/34' }, 'info')],
    [4, step('Checks GitHub en cours', B.checks, { checks: 'pending' })],
    [5, async () => {
      await change($, 'build', g => pipe(goTo(B.decision), log('Checks GitHub : verts', Date.now(), 'ok'))({ ...g, checks: 'ok', status: 'waiting' }))
    }],
    [10, async () => {
      const at = Date.now()
      await change($, 'build', g => log('PR #34 mergée (démo)', at, 'ok')({ ...g, status: 'merged', furthest: STAGES.build.length, endedAt: at }))
    }],
  ]
  // Ce que les faux agents font, seconde par seconde (t0 = début de la démo).
  const acts: [number, string, string][] = [
    [8.5, 'demo-build', 'Lit le ticket #12'],
    [9.5, 'demo-build', 'Lit src/profile/tastes.ts'],
    [10.5, 'demo-build', 'Écrit tastes.test.ts'],
    [11.5, 'demo-build', 'Lance les tests'],
    [12.5, 'demo-build', 'Modifie tastes.ts'],
    [13.5, 'demo-build', 'Modifie profile-page.tsx'],
    [16.5, 'demo-build', 'Corrige le test qui échoue'],
    [18, 'demo-build', 'Lance les tests'],
    [26, 'demo-std', 'Lit le diff de la branche'],
    [26.5, 'demo-risk', 'Lit le diff de la branche'],
    [27.5, 'demo-std', 'Lit AGENTS.md'],
    [28, 'demo-risk', 'Cherche « innerHTML »'],
    [29, 'demo-std', 'Compare au ticket #12'],
    [29.5, 'demo-risk', 'Vérifie les entrées utilisateur'],
    [30.5, 'demo-std', 'Écrit le rapport'],
    [31, 'demo-risk', 'Écrit le rapport'],
  ]
  for (const [secs, id, text] of acts) {
    demoTimers.push($.clock.after(secs * 1000, () => void update($, agents, recordActivity(id, text))))
  }

  let wait = 0
  for (const [secs, run] of script) {
    wait += secs * 1000
    demoTimers.push($.clock.after(wait, () => void run().then(() => update($, now, () => Date.now()))))
  }
}

/** Un ticket se construit (ou se cadre) en ce moment. */
const isLiveFlow = (f: Flow | null): boolean => !!f && !isFinished(f) && f.status !== 'stopped'

/** Ouvre ou ferme le panneau ; ouvert sans fenêtre dite, il montre le ticket en cours s'il y en a un, sinon les tickets du projet. */
async function togglePane($: EngineInterface, mode?: View): Promise<boolean> {
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen && (!mode || (await read($, view)) === mode)) {
    await $.ui.close({ id: PANE })
    return false
  }
  await openPane($, mode ?? (isLiveFlow(await read($, flow)) ? 'live' : 'board'))
  return true
}

/** Un /build-ticket démarre : le panneau passe sur le ticket en cours. */
async function followBuild($: EngineInterface, autoOpen: boolean): Promise<void> {
  await update($, view, () => 'live' as View)
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (autoOpen && !isOpen) await openPane($)
}

const totals = (list: AgentRun[]) => ({
  cost: list.reduce((s, a) => s + a.costUsd, 0),
  tokens: list.reduce((s, a) => s + a.tokens, 0),
})

// ---------------------------------------------------------------------------
// Ce que fait un sous-agent, dit en une ligne, d'après l'outil qu'il appelle.

const base = (p: unknown): string => (typeof p === 'string' ? p.replace(/\/+$/, '').split('/').pop() ?? p : '')

const activityOf = (e: Record<string, unknown>): string => {
  const tool = String(e.tool ?? '')
  const q = (k: string) => (typeof e[k] === 'string' ? (e[k] as string) : '')
  switch (tool) {
    case 'Read':
      return `Lit ${base(e.file_path)}`
    case 'Write':
      return `Écrit ${base(e.file_path)}`
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return `Modifie ${base(e.file_path ?? e.notebook_path)}`
    case 'Bash':
      return q('description') || `Lance ${clip(q('command').split('\n')[0] ?? '', 40)}`
    case 'Grep':
      return `Cherche « ${clip(q('pattern'), 30)} »`
    case 'Glob':
      return `Liste ${clip(q('pattern'), 30)}`
    case 'WebSearch':
      return `Recherche « ${clip(q('query'), 30)} »`
    case 'WebFetch':
      return `Lit ${clip(q('url').replace(/^https?:\/\//, ''), 36)}`
    case 'Skill':
      return `Charge le skill ${bareSkill(q('skill'))}`
    case 'Agent':
    case 'Task':
      return `Délègue : ${clip(q('description'), 36)}`
    case 'TodoWrite':
      return 'Met à jour sa liste'
    default:
      return tool.startsWith('mcp__') ? `Utilise ${tool.split('__').slice(1).join(' · ')}` : tool ? `Utilise ${tool}` : ''
  }
}

const recordActivity = (agentId: string, text: string) => (list: AgentRun[]): AgentRun[] =>
  list.map(a =>
    a.agentId !== agentId
      ? a
      : {
          ...a,
          actions: (a.actions ?? 0) + 1,
          current: text,
          recent: [a.current, ...(a.recent ?? [])].filter((x): x is string => !!x).slice(0, 2),
        },
  )

// Une couleur de Clawd par agent, stable d'un dessin à l'autre.
const AGENT_COLORS = ['#D9534F', '#3B9C5F', '#3B6FD9', '#D2578F', '#D97757', '#8B5CF6', '#0E9AA7', '#C08A1E']
const colorOf = (id: string): string => {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return AGENT_COLORS[h % AGENT_COLORS.length] as string
}

// Clawd d'agent, plus petit : il marche quand l'agent tourne.
const AGENT_SPRITE: readonly (readonly [string, string, string])[] = [
  ['▐▛███▜▌', '▝▜█████▛▘', '  ▘▘ ▝▝'],
  ['▐▛███▜▌', '▝▜█████▛▘', '  ▝▘ ▝▘'],
]
const AGENT_DONE: readonly [string, string, string] = ['▐▛███▜▌', '▝▜█████▛▘', '  ▘▘ ▝▝']
const AGENT_FAILED: readonly [string, string, string] = ['▐▀███▀▌', '▝▜█████▛▘', '  ▘▘ ▝▝']

// Sans total connu, la barre d'un agent qui tourne avance vite puis ralentit.
const agentRatio = (a: AgentRun): number =>
  a.status === 'running' ? Math.min(0.92, 1 - Math.exp(-(a.actions ?? a.steps) / 10)) : 1

// Le rôle d'un sous-agent dans le workflow, d'après l'étape où il est lancé.
const roleOf = (f: Flow | null, type: string, description: string): string => {
  const d = `${type} ${description}`.toLowerCase()
  if (/haiku|taille/.test(d)) return 'taille'
  if (/risk|risque|faille/.test(d)) return 'risques'
  if (/review|relect|relire|standard|spec/.test(d)) return 'relecteur'
  if (!f || f.kind !== 'build') return type || 'agent'
  if (f.stage <= B.construire) return 'constructeur'
  if (f.stage === B.relire) return 'relecteur'
  return type || 'agent'
}

const STATUS_GLYPH: Record<string, string> = { running: '●', done: '✓', failed: '✗' }

// ---------------------------------------------------------------------------
// Le tableau des tickets : le deuxième mode du panneau.

const TICKET_LOOK: Record<TicketState, { glyph: string; color?: string; word: string }> = {
  done: { glyph: '✓', color: OK, word: 'fait' },
  review: { glyph: '◆', color: '#a855f7', word: 'PR à décider' },
  building: { glyph: '●', color: ACCENT, word: 'en construction' },
  question: { glyph: '?', color: KO, word: 'question pour toi' },
  human: { glyph: '✗', color: KO, word: 'arrêté' },
  ready: { glyph: '▶', color: INFO, word: 'prêt' },
  waiting: { glyph: '○', word: 'attend' },
  draft: { glyph: '·', word: 'pas prêt' },
}

let boardRun: Promise<void> | null = null
let boardDirty = false
let bandHidden = false

/** Relit le tableau (GitHub ou fichiers locaux) ; un seul chargement à la fois. */
async function refreshBoard($: EngineInterface): Promise<void> {
  if (boardRun) return boardRun
  boardRun = (async () => {
    await update($, boardLoading, () => true)
    try {
      const b = await loadBoard($, Date.now()).catch(() => null)
      await update($, board, () => b)
    } finally {
      await update($, boardLoading, () => false)
      boardRun = null
    }
  })()
  return boardRun
}

const GOAL_SYSTEM =
  "Tu expliques un ticket de développement à son commanditaire, qui n'est pas développeur. " +
  "Réponds par UNE seule phrase en français, 25 mots au plus, qui dit ce que ce ticket permettra une fois fait " +
  "(ce que l'utilisateur pourra faire, ou ce que ça prépare), sans jargon technique, sans nom de fichier, sans guillemets ni préambule."

/** La phrase d'objectif d'un ticket : écrite par Haiku la première fois, puis gardée. */
async function explain($: EngineInterface, t: BoardTicket): Promise<void> {
  const key = t.key ?? t.ref
  if ((await read($, goals))[key] !== undefined) return
  await update($, goals, g => ({ ...g, [key]: '' }))
  const fallback = firstSentence(t.about ?? '') || t.title
  let sentence = fallback
  if (t.about) {
    const r = await $.model
      .complete({
        model: 'haiku',
        system: GOAL_SYSTEM,
        prompt: `Titre du ticket : ${t.title}\n\nCe qu'il faut construire :\n${t.about}`,
        maxTokens: 120,
        timeoutMs: 20_000,
      })
      .catch(() => null)
    const text = r && r.isAnswered ? r.text.trim().replace(/^["«\s]+|["»\s]+$/g, '').split('\n')[0] : ''
    if (text) sentence = text
  }
  await update($, goals, g => ({ ...g, [key]: sentence }))
}

/** Un clic sur un ticket : le déplie (et demande sa phrase), ou le replie. */
async function toggleTicket($: EngineInterface, t: BoardTicket): Promise<void> {
  const key = t.key ?? t.ref
  const was = await read($, opened)
  await update($, opened, () => (was === key ? null : key))
  if (was !== key) await explain($, t)
}

async function showBoard($: EngineInterface): Promise<void> {
  await openPane($, 'board')
}

const waitWord = (b: Board, t: BoardTicket): string => {
  const refs = t.waitsOn.map(n => (b.source === 'local' ? String(n).padStart(2, '0') : `#${n}`))
  return refs.length ? `attend ${refs.join(', ')}` : TICKET_LOOK[t.state].word
}

const ago = (at: number, then: number): string => {
  const s = Math.max(0, Math.round((at - then) / 1000))
  return s < 60 ? 'à l’instant' : s < 3600 ? `il y a ${Math.floor(s / 60)} min` : `il y a ${Math.floor(s / 3600)} h`
}

// /ticket-statut et /an-forge ticket status : la même réponse.
async function runStatut($: EngineInterface, raw: string): Promise<{ text: string }> {
  const arg = raw.trim().toLowerCase()
  if (arg === 'reset') {
    stopDemo()
    await update($, flow, () => null)
    await update($, agents, () => [])
    return { text: 'Suivi du ticket en cours remis à zéro.' }
  }
  if (arg === 'demo') {
    await playDemo($)
    void openPane($, 'live')
    return { text: 'Démo lancée : un faux ticket défile pendant une minute dans « Ticket en cours », sans toucher à GitHub.' }
  }
  if (['projet', 'tickets', 'board'].includes(arg)) {
    await openPane($, 'board')
    return { text: 'Ticket statut : tickets du projet.' }
  }
  if (['en-cours', 'encours', 'ticket', 'live'].includes(arg)) {
    await openPane($, 'live')
    return { text: 'Ticket statut : ticket en cours.' }
  }
  if (arg === 'open') {
    await openPane($, isLiveFlow(await read($, flow)) ? 'live' : 'board')
    return { text: 'Ticket statut ouvert.' }
  }
  return { text: (await togglePane($)) ? 'Ticket statut ouvert.' : 'Ticket statut fermé.' }
}

export const register: Register = (on, options) => {
  const autoOpen = options.autoOpen !== 'non'
  const clawd = options.clawd !== 'non'

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: COMMAND,
      description: "Affiche ou masque Ticket statut : les tickets du projet et le ticket en cours (/ticket-statut projet, /ticket-statut en-cours, /ticket-statut demo : faux ticket, /ticket-statut reset : efface le suivi)",
    })
    await $.command.register({
      name: LONG_COMMAND,
      description: 'Ticket statut, en version longue : /an-forge ticket status [projet | en-cours | demo | reset]',
      argumentHint: 'ticket status [projet | en-cours]',
    })
    if (clawd) {
      $.clock.every(FRAME_MS, () => {
        void (async () => {
          const busy = (await read($, agents)).some(a => a.status === 'running')
          if (busy || isAnimated(await read($, flow), Date.now())) await update($, frame, n => (n + 1) % 1200)
        })()
      })
    }
    // Le tableau du projet, lu en fond : il nourrit la barre quand aucun ticket ne tourne.
    void refreshBoard($)
    $.clock.every(1000, () => {
      void (async () => {
        const f = await read($, flow)
        const list = await read($, agents)
        const isLive = (f && !isFinished(f) && f.status === 'running') || list.some(a => a.status === 'running')
        if (isLive) await update($, now, () => Date.now())
      })()
    })
    return started
  })

  on('command.run', { command: LONG_COMMAND }, async ($, e) => {
    const args = (e.args ?? '').trim()
    if (!LONG_PREFIX.test(args)) {
      return { text: 'Usage : /an-forge ticket status [projet | en-cours | demo | reset]. Les skills d’an-forge restent sous /an-forge:<skill> (ex. /an-forge:build-ticket).' }
    }
    return runStatut($, args.replace(LONG_PREFIX, ''))
  })

  on('command.run', { command: COMMAND }, async ($, e) => runStatut($, e.args ?? ''))


  // --- Les skills : ils ouvrent un flux et le font changer d'étape.
  on('skill.prompt', async ($, e, next) => {
    const result = await next(e)
    const skill = bareSkill(e.skill)
    const at = Date.now()
    const f = await read($, flow)

    switch (skill) {
      case 'build-ticket':
        if (await start($, 'build', at, '/build-ticket lancé')) await followBuild($, autoOpen)
        break
      case 'project-launch':
        await start($, 'launch', at, '/project-launch lancé')
        break
      case 'quick-ticket':
        await start($, 'quick', at, '/quick-ticket lancé')
        break
      case 'grill-with-docs':
      case 'grilling':
        if (!f || isFinished(f)) await start($, 'launch', at, 'Interrogatoire')
        await change($, 'launch', pipe(goTo(L.grill), log('Interrogatoire', at)))
        break
      case 'to-spec':
        await change($, 'launch', pipe(goTo(L.spec), log('Écriture de la spec', at)))
        break
      case 'to-tickets':
        await change($, 'launch', pipe(goTo(L.tickets), log('Découpage en tickets', at)))
        break
      case 'before-after':
      case 'diagnosing-bugs':
        await change($, 'build', g =>
          g.furthest < B.construire
            ? pipe(goTo(B.avant), log(skill === 'before-after' ? "Captures de l'avant" : 'Reproduction du bug', at))(g)
            : g.furthest >= B.apres || g.stage === B.relire || g.furthest >= B.relire
              ? pipe(goTo(B.apres), log("Captures de l'après", at))(g)
              : g,
        )
        break
      case 'tdd':
        await change($, 'build', g => (g.stage < B.construire ? pipe(goTo(B.construire), log('Construction en TDD', at))(g) : g))
        break
      case 'code-review':
        await change($, 'build', g =>
          pipe(goTo(B.relire), log(`Relectures, tour ${g.reviewRound + 1}`, at))({ ...g, reviewRound: g.reviewRound + 1 }),
        )
        break
      case 'risk-review':
        await change($, 'build', g => (g.stage === B.relire ? g : pipe(goTo(B.relire), log('Relecture des risques', at))(g)))
        break
      case 'feature-brief':
        await change($, 'build', pipe(goTo(B.brief), log('Écriture du brief', at)))
        break
    }
    return result
  })

  // --- Ce que font les sous-agents : chaque outil qu'ils appellent.
  on('tool.call', async ($, e, next) => {
    const agentId = (e as { agentId?: string }).agentId
    const path = (e as { file_path?: unknown }).file_path
    if (typeof path === 'string' && /\.scratch\/.+\/issues\/.+\.md$/.test(path)) boardDirty = true
    if (agentId) {
      const text = activityOf(e as unknown as Record<string, unknown>)
      if (text) await update($, agents, recordActivity(agentId, text))
    }
    return next(e)
  })

  // --- Les scripts d'an-forge, reconnus dans les commandes Bash.
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    if (/\b(start-ticket|merge-pr|flag-ticket|cleanup)\.sh\b|\bgh (pr|issue) (create|edit|close|merge|reopen)\b|\bgh api\b.*(sub_issues|dependencies)|\.scratch\/[^\s]*\/issues/.test(e.command)) boardDirty = true
    const isForge = /\b(start-ticket|tickets|pick-model|gate|pr-checks|merge-pr|flag-ticket|cleanup|capture)\.sh\b|\bgh (pr|issue) create\b|\brender\.py\b/.test(e.command)
    if (!isForge || ran.deny !== undefined) return ran

    const out = outputOf(ran)
    const failed = ran.isError === true
    const at = Date.now()

    // Une commande peut enchaîner plusieurs scripts (a && b ; c) : chacun compte.
    // Si la commande a échoué, on ne sait pas lequel a tourné : un script ne compte
    // alors que si sa sortie reconnaissable est là (dans « a && b », a qui échoue
    // empêche b de tourner).
    const segments = e.command.split(/&&|\|\||;|\n/).map(x => x.trim()).filter(Boolean)
    const chainFailed = failed && segments.length > 1
    for (const cmd of segments) {
      if (chainFailed) {
        const sig = SIGNATURES.find(([script]) => script.test(cmd))?.[1]
        if (!sig || !sig.test(out)) continue
      }
      // Dans une chaîne qui a échoué, un script dont la sortie est là a réussi
      // (sauf gate et merge-pr, qui disent eux-mêmes leur résultat).
      const failed = ran.isError === true && !chainFailed
      const f = await read($, flow)
      // Un script de build-ticket sans flux ouvert : le skill a été lancé avant le chargement du mod.
      if ((!f || isFinished(f) || f.kind !== 'build') && /\b(start-ticket|gate|pr-checks|merge-pr)\.sh\b/.test(cmd)) {
        if (await start($, 'build', at, 'Ticket repris en cours de route')) await followBuild($, autoOpen)
      }

      if (/\bstart-ticket\.sh\b/.test(cmd) && !failed) {
        const m = /start-ticket\.sh\s+(?:--new\s+)?(\d+)(?:\s+(?:"([^"]*)"|'([^']*)'))?/.exec(cmd)
        const branch = kv(out, 'branch')
        const n = Number(m?.[1] ?? /ticket\/(\d+)/.exec(branch ?? '')?.[1])
        const title = (m?.[2] ?? m?.[3] ?? '').trim() || titleFromBranch(branch ?? '')
        await change($, 'build', g =>
          pipe(
            goTo(B.isoler),
            log(`Ticket #${n} réservé${kv(out, 'status') === 'reused' ? ' (reprise)' : ''}`, at, 'info'),
          )({
            ...g,
            ticket: Number.isFinite(n) && n > 0 ? n : g.ticket,
            title: title || g.title,
            branch: branch ?? g.branch,
            worktree: kv(out, 'worktree') ?? g.worktree,
            base: kv(out, 'base') ?? g.base,
          }),
        )
      } else if (/\btickets\.sh\s+check\b/.test(cmd)) {
        const taille = kv(out, 'taille')
        if (taille && taille !== 'inconnue') await change($, 'build', g => ({ ...g, taille }))
      } else if (/\btickets\.sh\s+next\b/.test(cmd)) {
        const m = /^(\d+)\t(.+)$/m.exec(out)
        if (m) await change($, 'build', g => (g.ticket ? g : { ...g, ticket: Number(m[1]), title: (m[2] ?? '').trim() || g.title }))
      } else if (/\bpick-model\.sh\b/.test(cmd)) {
        const taille = /pick-model\.sh\s+(petit|moyen|gros)/.exec(cmd)?.[1]
        const build = kv(out, 'build')
        const review = kv(out, 'review')
        await change($, 'build', g =>
          log(`Modèles : construction ${build ?? '?'}, relecture ${review ?? '?'}`, at)({
            ...g,
            taille: taille ?? g.taille,
            buildModel: build ?? g.buildModel,
            reviewModel: review ?? g.reviewModel,
          }),
        )
      } else if (/\bgate\.sh\b/.test(cmd)) {
        const pass = /GATE:\s*PASS/.test(out) && !failed
        const touched = /TESTS EXISTANTS TOUCHÉS/.test(out)
        await change($, 'build', g => {
          // Après une relecture, un gate qui passe est la revérification : on reste sur « Relire ».
          const stay = g.stage === B.relire && pass
          const updated: Flow = {
            ...g,
            gatePass: g.gatePass + (pass ? 1 : 0),
            gateFail: pass ? 0 : g.gateFail + 1,
            gateLast: pass ? 'pass' : 'fail',
          }
          return pipe(
            stay || g.stage > B.relire ? (x: Flow) => x : goTo(B.tester),
            log(pass ? `Gate : PASS${touched ? ', tests existants touchés' : ''}` : `Gate : FAIL (${updated.gateFail}/3)`, at, pass ? 'ok' : 'ko'),
          )(updated)
        })
      } else if (/\bgh pr create\b/.test(cmd) && !failed) {
        const url = /https:\/\/github\.com\/\S+\/pull\/(\d+)/.exec(out)
        await change($, 'build', g =>
          pipe(goTo(B.pr), log(`PR ${url ? '#' + url[1] : ''} ouverte`, at, 'info'))({
            ...g,
            pr: url ? Number(url[1]) : g.pr,
            prUrl: url?.[0] ?? g.prUrl,
          }),
        )
      } else if (/\bgh issue create\b/.test(cmd) && !failed) {
        const n = Number(/\/issues\/(\d+)/.exec(out)?.[1] ?? 0)
        if (n) {
          await change($, null, g => {
            if (g.kind === 'launch') {
              const isSpec = g.stage === L.spec && !g.spec
              return log(isSpec ? `Spec #${n} publiée` : `Ticket #${n} publié`, at, 'ok')(
                isSpec ? { ...g, spec: n } : { ...g, issues: [...g.issues, n] },
              )
            }
            if (g.kind === 'quick') return pipe(goTo(Q.pret), log(`Ticket #${n} publié`, at, 'ok'))({ ...g, issues: [n], status: 'done', endedAt: at })
            return g
          })
        }
      } else if (/\bcapture\.sh\b/.test(cmd)) {
        await change($, 'build', g =>
          g.furthest < B.construire
            ? pipe(goTo(B.avant), log("Captures de l'avant", at))(g)
            : pipe(goTo(B.apres), log("Captures de l'après", at))(g),
        )
      } else if (/\brender\.py\b/.test(cmd)) {
        await change($, 'build', g => (g.stage < B.brief ? pipe(goTo(B.brief), log('Brief rendu', at))(g) : g))
      } else if (/\bpr-checks\.sh\b/.test(cmd)) {
        const checks = kv(out, 'checks') ?? (/backgroundTaskId/.test(JSON.stringify(ran)) ? 'pending' : undefined)
        const preview = kv(out, 'preview')
        await change($, 'build', g => {
          const base: Flow = { ...g, checks: checks ?? g.checks, preview: preview ?? g.preview }
          if (checks === 'ok' || checks === 'none') {
            return pipe(
              goTo(B.decision),
              log(checks === 'ok' ? 'Checks GitHub : verts' : 'Pas de checks GitHub sur ce projet', at, 'ok'),
            )({ ...base, status: 'waiting' as FlowStatus })
          }
          if (checks === 'fail') return pipe(goTo(B.checks), log('Checks GitHub : échec', at, 'ko'))(base)
          return goTo(B.checks)(base)
        })
      } else if (/\bmerge-pr\.sh\b/.test(cmd)) {
        const merged = /MERGÉE/.test(out) && !failed
        await change($, 'build', g =>
          merged
            ? log(`PR ${g.pr ? '#' + g.pr : ''} mergée`, at, 'ok')({ ...g, status: 'merged', furthest: STAGES.build.length, endedAt: at })
            : log('Merge refusé pour l’instant : mise à jour ou checks à relancer', at, 'ko')(g),
        )
      } else if (/\bflag-ticket\.sh\s+(needs-info|human|ready)\b/.test(cmd) && !failed) {
        const kind = /flag-ticket\.sh\s+(needs-info|human|ready)/.exec(cmd)?.[1]
        await change($, 'build', g =>
          kind === 'needs-info'
            ? log('Question posée sur le ticket (needs-info)', at, 'ko')({ ...g, status: 'needs-info', endedAt: at })
            : kind === 'human'
              ? log('Arrêt en route (ready-for-human)', at, 'ko')({ ...g, status: 'stopped', endedAt: at })
              : log('Ticket de nouveau prêt', at, 'info')({ ...g, status: 'running', endedAt: undefined }),
        )
      }
    }
    return ran
  })

  // --- Les sous-agents : constructeur, relecteurs.
  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started
    const at = Date.now()
    const f = await read($, flow)
    const role = roleOf(f, e.subagentType, e.description)
    if (f && f.kind === 'build' && role === 'constructeur' && f.stage < B.construire) {
      await change($, 'build', pipe(goTo(B.construire), log(`Constructeur lancé (${modelName(started.model)})`, at)))
    }
    // Un relecteur lancé après le gate : c'est la relecture, même sans le skill code-review dans cette session.
    if (f && f.kind === 'build' && (role === 'relecteur' || role === 'risques') && f.furthest >= B.tester && f.stage !== B.relire && f.stage < B.apres) {
      await change($, 'build', g =>
        pipe(goTo(B.relire), log(`Relectures, tour ${g.reviewRound + 1}`, at))({ ...g, reviewRound: g.reviewRound + 1 }),
      )
    }
    await update($, agents, list => {
      const run: AgentRun = {
        id: started.agentId ?? e.tool_use_id,
        agentId: started.agentId,
        role,
        type: e.subagentType,
        description: e.description,
        model: started.model,
        status: 'running',
        startedAt: at,
        tokens: 0,
        costUsd: 0,
        steps: 0,
      }
      return [...list.filter(a => a.id !== run.id), run].slice(-100)
    })
    await update($, now, () => at)
    return started
  })

  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const agentId = e.agentId
    const usage = result.usage
    if (!agentId || !usage) return result
    const model = usage.model || e.model
    await update($, agents, list =>
      list.map((a): AgentRun =>
        a.agentId !== agentId
          ? a
          : { ...a, model, tokens: a.tokens + tokensOf(usage), costUsd: a.costUsd + costOf(model, usage), steps: a.steps + 1 },
      ),
    )
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const at = Date.now()
    if (e.agentId) {
      const agentId = e.agentId
      await update($, agents, list =>
        list.map((a): AgentRun => {
          if (a.agentId !== agentId) return a
          const fallback = a.steps === 0 && e.usage
          return {
            ...a,
            status: e.reason === 'answer' ? 'done' : 'failed',
            endedAt: at,
            ...(fallback && e.usage
              ? { tokens: tokensOf(e.usage), costUsd: costOf(e.usage.model || a.model, e.usage) }
              : {}),
          }
        }),
      )
    } else {
      // Fin d'un tour de la session principale : le découpage en tickets est publié.
      const before = await read($, flow)
      await change($, 'launch', g =>
        g.stage === L.tickets && g.issues.length > 0 && !isFinished(g)
          ? pipe(goTo(L.pret), log(`${g.issues.length} ticket(s) prêt(s) à construire`, at, 'ok'))({ ...g, status: 'done', endedAt: at })
          : g,
      )
      const after = await read($, flow)
      const launched = before?.kind === 'launch' && before.status !== 'done' && after?.kind === 'launch' && after.status === 'done'
      if (launched) {
        boardDirty = false
        bandHidden = false
        if (autoOpen) void showBoard($)
        else void refreshBoard($)
      } else if (boardDirty) {
        boardDirty = false
        void refreshBoard($)
      }
    }
    await update($, now, () => at)
    return next(e)
  })

  // --- Le panneau Ticket statut : deux fenêtres, les tickets du projet et le ticket en cours.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    // Le Raster (pixels) n'existe que sur le terminal ; ailleurs, Clawd en caractères.
    const Raster = 'Raster' in els ? els.Raster : undefined
    const f = await read($, flow)
    const list = await read($, agents)
    const at = Math.max(await read($, now), Date.now())
    const tick = await read($, frame)
    const cols = Math.max(28, e.props.bodyColumns || 40)
    const t = totals(list)
    const mode = await read($, view)
    const sectionBar = (label: string, color: string, ink = '#ffffff') => (
      <Box key={`sec-${label}`} marginTop={1} backgroundColor={color} paddingX={1}>
        <Text bold color={ink}>▾ {label}</Text>
      </Box>
    )

    // Les deux modes du panneau : le ticket en cours, les tickets du projet.
    const tab = (id: View, label: string) =>
      mode === id ? (
        <Box key={`tab-${id}`} backgroundColor={ACCENT} paddingX={1}>
          <Text bold color="#1a1a1a">{label}</Text>
        </Box>
      ) : (
        <Button key={`tab-${id}`} label={label} variant="primary" onPress={async () => {
          await update($, view, () => id)
          if (id === 'board') void refreshBoard($)
        }} />
      )
    const tabs = (
      // Le projet à gauche, le ticket en cours à droite.
      <Box key="tabs" flexDirection="row" justifyContent="space-between" gap={1} marginBottom={1}>
        {tab('board', '☰ Tickets du projet')}
        {tab('live', f && f.kind === 'build' && f.ticket && !isFinished(f) ? `⚒ Ticket en cours · #${f.ticket}` : '⚒ Ticket en cours')}
      </Box>
    )

    if (mode === 'board') {
      const b = await read($, board)
      const loading = await read($, boardLoading)
      const refresh = <Button key="refresh" label={loading ? 'Lecture…' : 'Actualiser'} variant="primary" onPress={() => void refreshBoard($)} />
      if (!b) {
        return (
          <Box flexDirection="column">
            {tabs}
            <Text color="text" bold>{loading ? 'Lecture des tickets…' : 'Pas de tickets an-forge ici'}</Text>
            {!loading && (
              <Text dimColor wrap="wrap">
                Ce dossier n'a pas de docs/agents/issue-tracker.md. Lance /project-init, puis /project-launch : les tickets s'afficheront ici.
              </Text>
            )}
            <Box marginTop={1}>{refresh}</Box>
          </Box>
        )
      }
      const c = countOf(b)
      const steps = nextSteps(b)
      const open = await read($, opened)
      const known = await read($, goals)
      // Sous un ticket déplié : la phrase d'objectif.
      const goalLine = (x: BoardTicket, where: string) => {
        const key = x.key ?? x.ref
        if (open !== key) return null
        const g = known[key]
        return (
          <Box key={`goal-${where}-${key}`} paddingLeft={3} marginBottom={1}>
            {g ? (
              <Text color={ACCENT} wrap="wrap">↳ {g}</Text>
            ) : (
              <Text dimColor>↳ Je résume l’objectif…</Text>
            )}
          </Box>
        )
      }
      const nameW = Math.max(10, cols - 26)
      const specBar = Math.max(6, Math.min(24, cols - 30))
      return (
        <Box flexDirection="column">
          {tabs}
          <Text dimColor wrap="truncate-end">
            {b.source === 'github' ? `GitHub · ${b.where}` : 'Fichiers locaux · .scratch'} · lu {ago(at, b.loadedAt)}
          </Text>
          {b.error && (
            <Text color={KO} wrap="wrap">{b.error}</Text>
          )}

          {c.total > 0 && (
            <Box flexDirection="row" gap={1} marginTop={1}>
              {(
                [
                  ['Faits', `${c.done}/${c.total}`, OK],
                  ['En cours', String(c.live), ACCENT],
                  ['Prêts', String(c.ready), INFO],
                  ['En attente', String(c.waiting), '#9ca3af'],
                ] as const
              ).map(([label, value, color]) => (
                <Box key={`btile-${label}`} flexDirection="column" borderStyle="round" borderDimColor paddingX={1} flexGrow={1}>
                  <Text dimColor wrap="truncate-end">{label}</Text>
                  <Text bold color={color}>{value}</Text>
                </Box>
              ))}
            </Box>
          )}

          {c.total > 0 && (
            <Box flexDirection="column">
              {sectionBar('À faire maintenant', INFO)}
              {steps.length === 0 ? (
                <Text color="text" wrap="wrap">
                  {c.done === c.total
                    ? 'Tout est fait 🎉'
                    : c.live > 0
                      ? 'Rien de libre : les tickets restants attendent ceux en construction.'
                      : 'Rien de libre : les tickets restants attendent d’autres tickets ou ne sont pas encore prêts.'}
                </Text>
              ) : (
                steps.slice(0, 4).map((s, i) => {
                  const look = TICKET_LOOK[s.ticket.state]
                  return (
                    <Box key={`next-${s.ticket.key ?? s.ticket.ref}-${i}`} flexDirection="column">
                      <Button key={`pick-next-${s.ticket.key ?? s.ticket.ref}`} plain onPress={() => toggleTicket($, s.ticket)}>
                        <Text color={look.color}>{look.glyph} </Text>
                        <Text color="text" bold>{s.ticket.ref} </Text>
                        <Text color="text">{clip(s.ticket.title, Math.max(10, cols - 8))}</Text>
                      </Button>
                      <Text wrap="truncate-end">
                        {'   '}
                        <Text dimColor>{s.text}</Text>
                        {s.command && <Text color={ACCENT} bold> → {s.command}</Text>}
                      </Text>
                      {goalLine(s.ticket, 'next')}
                    </Box>
                  )
                })
              )}
              {steps.length > 4 && <Text dimColor>… et {steps.length - 4} autre(s) prêt(s)</Text>}
              <Text dimColor wrap="wrap">Clique sur un ticket pour voir son objectif en une phrase.</Text>
              {steps.filter(s => s.ticket.state === 'ready').length > 1 && (
                <Text dimColor wrap="wrap">Un ticket par session : /build-ticket seul prend le plus petit numéro libre.</Text>
              )}
            </Box>
          )}

          {b.specs.map(sp => {
            const done = sp.tickets.filter(x => x.state === 'done').length
            const r = sp.tickets.length ? done / sp.tickets.length : 0
            return (
              <Box key={`spec-${sp.ref || 'none'}`} flexDirection="column">
                {sectionBar(`${sp.ref ? `${sp.ref} ` : ''}${clip(sp.title, Math.max(10, cols - 8))}`, '#3B6FD9')}
                <Text color="text" wrap="truncate-end">
                  <Text color={OK}>{bar(r, specBar)}</Text>
                  <Text bold> {done}/{sp.tickets.length} faits</Text>
                </Text>
                {sp.tickets.map(x => {
                  const look = TICKET_LOOK[x.state]
                  const isDone = x.state === 'done'
                  const word = x.state === 'review' ? `PR #${x.pr}` : x.state === 'waiting' ? waitWord(b, x) : look.word
                  const faded = x.state === 'waiting' || x.state === 'draft'
                  return (
                    <Box key={`t-${sp.ref}-${x.ref}-${x.state}`} flexDirection="column">
                      <Box flexDirection="row" justifyContent="space-between" gap={1}>
                        <Box width={nameW} flexShrink={1}>
                          <Button key={`pick-${x.key ?? x.ref}`} plain dimColor={faded} onPress={() => toggleTicket($, x)}>
                            <Text color={look.color}>{look.glyph} </Text>
                            <Text color={isDone ? OK : 'text'}>{clip(`${x.ref} ${x.title}`, Math.max(8, nameW - 2))}</Text>
                          </Button>
                        </Box>
                        <Text color={look.color} dimColor={!look.color} wrap="truncate-end">{word}</Text>
                      </Box>
                      {goalLine(x, 'spec')}
                    </Box>
                  )
                })}
              </Box>
            )
          })}

          {c.total === 0 && !b.error && (
            <Text color="text" wrap="wrap">Aucun ticket ouvert. Lance /project-launch pour cadrer la suite, ou /quick-ticket pour une petite demande.</Text>
          )}

          <Box flexDirection="row" gap={1} marginTop={1}>{refresh}</Box>
        </Box>
      )
    }

    if (!f && list.length === 0) {
      return (
        <Box flexDirection="column">
          {tabs}
          <Text color="text" bold>Aucun ticket en cours</Text>
          <Text dimColor wrap="wrap">
            Lance /build-ticket : tu suivras ici le ticket étape par étape, avec ses agents. Ce qu'il reste à faire est dans « Tickets du projet ».
          </Text>
        </Box>
      )
    }

    const stages = f ? STAGES[f.kind] : []
    const detail = (i: number): string => {
      if (!f || f.kind !== 'build') {
        if (f?.kind === 'launch' && i === L.spec && f.spec) return `#${f.spec}`
        if (f?.kind === 'launch' && i === L.tickets && f.issues.length) return `${f.issues.length} publié(s)`
        return ''
      }
      switch (i) {
        case B.isoler:
          return f.branch ?? ''
        case B.construire:
          return f.buildModel ? `modèle ${f.buildModel}` : ''
        case B.tester:
          return f.gateLast ? `${f.gateLast === 'pass' ? 'PASS' : 'FAIL'}${f.gateFail ? ` · ${f.gateFail} échec(s)` : ''}` : ''
        case B.relire:
          return f.reviewRound ? `tour ${f.reviewRound}/2${f.reviewModel ? ` · ${f.reviewModel}` : ''}` : ''
        case B.pr:
          return f.pr ? `#${f.pr}` : ''
        case B.checks:
          return f.checks ?? ''
        case B.decision:
          return f.status === 'merged' ? 'mergé' : f.status === 'waiting' ? '« merge la PR » ou ce qu’il faut changer' : ''
        default:
          return ''
      }
    }

    const glyph = (i: number): [string, string | undefined] => {
      if (!f) return ['○', undefined]
      if (isFinished(f) || i < f.stage || (i <= f.furthest && i !== f.stage)) return ['✓', OK]
      if (i === f.stage) {
        if (f.status === 'stopped' || f.status === 'needs-info') return ['✗', KO]
        if (f.kind === 'build' && i === B.tester && f.gateLast === 'fail') return ['●', KO]
        return ['●', ACCENT]
      }
      return ['○', undefined]
    }

    const running = list.filter(a => a.status === 'running').reverse()
    const finished = list.filter(a => a.status !== 'running').reverse().slice(0, 8)
    const elapsed = f ? (f.endedAt ?? at) - f.startedAt : 0
    const room = Math.max(4, (e.viewport?.rows ?? 40) - 30)
    const cardW = Math.max(16, cols - 22)
    const headBar = Math.max(8, Math.min(30, cols - (cols >= 70 ? 44 : 30)))

    // Coût, tokens, temps : en haut, sous la barre de progression.
    const tiles = (
      <Box flexDirection="row" gap={1} marginBottom={1}>
        {(
          [
            ['Coût total', `≈${fmtCost(t.cost)}`],
            ['Tokens agents', fmtTokens(t.tokens)],
            ['Temps', fmtTime(elapsed || (list.length ? at - Math.min(...list.map(a => a.startedAt)) : 0))],
          ] as const
        ).map(([label, value]) => (
          <Box key={`tile-${label}`} flexDirection="column" borderStyle="round" borderDimColor paddingX={1} flexGrow={1}>
            <Text dimColor wrap="truncate-end">{label}</Text>
            <Text bold color={ACCENT}>{value}</Text>
          </Box>
        ))}
      </Box>
    )

    const agentCard = (a: AgentRun) => {
      const color = colorOf(a.id)
      const sprite = a.status === 'running' ? pick(AGENT_SPRITE, tick) : a.status === 'failed' ? AGENT_FAILED : AGENT_DONE
      const stepN = a.actions ?? a.steps
      const used = `${fmtTokens(a.tokens)} tokens · ${fmtTime((a.endedAt ?? at) - a.startedAt)}`
      return (
        <Box key={`card-${a.id}`} flexDirection="row" gap={2} borderStyle="round" borderColor={color} paddingX={1} marginTop={1}>
          {Raster ? (
            <Box flexShrink={0} alignSelf="center">
              <Raster key={`clawd-${a.id}`} {...raster(pick(AGENT_PX[a.status], tick), a.status === 'failed' ? '#6b7280' : color)} />
            </Box>
          ) : (
            <Box flexDirection="column" flexShrink={0} width={9} justifyContent="center">
              {sprite.map((line, i) => (
                <Text key={`s-${i}`} color={color}>{line}</Text>
              ))}
            </Box>
          )}
          <Box flexDirection="column" flexGrow={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text color="text" bold wrap="truncate-end">{clip(a.description || a.role, Math.max(10, cardW - 4))}</Text>
              <Text color={a.status === 'failed' ? KO : OK}>{a.status === 'running' ? '●' : a.status === 'done' ? '✓' : '✗'}</Text>
            </Box>
            <Box flexDirection="row" justifyContent="space-between" gap={1}>
              <Text dimColor wrap="truncate-end">{a.role} · {modelName(a.model)}</Text>
              <Text dimColor>{used}</Text>
            </Box>
            {a.status === 'running' ? (
              <Text color={ACCENT} wrap="truncate-end">◑ Étape {Math.max(1, stepN)}{a.current ? ` · ${a.current}` : ''}</Text>
            ) : a.status === 'done' ? (
              <Text color={OK} wrap="truncate-end">Terminé · {stepN} étape{stepN > 1 ? 's' : ''} · ≈{fmtCost(a.costUsd)}</Text>
            ) : (
              <Text color={KO}>Échec</Text>
            )}
            {(a.status === 'running' ? a.recent ?? [] : [a.current, ...(a.recent ?? [])].filter((x): x is string => !!x).slice(0, 2)).map((r, i) => (
              <Text color="text" key={`r-${i}`} wrap="truncate-end">{r}</Text>
            ))}
            <Text color={color}>{'━'.repeat(Math.round(cardW * agentRatio(a)))}<Text dimColor>{'━'.repeat(Math.max(0, cardW - Math.round(cardW * agentRatio(a))))}</Text></Text>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column">
        {tabs}
        {f && (
          <Box flexDirection="row" gap={2} marginBottom={1} alignItems="center">
          {clawd && cols >= 40 && Raster ? (
            <Box flexShrink={0}>
              <Raster key="clawd" {...raster(pick(BIG[moodOf(f)], tick), CLAWD, cols >= 70 ? 2 : 1)} />
            </Box>
          ) : clawd && cols >= 40 ? (
            <Box flexDirection="column" flexShrink={0} width={12}>
              {pick(SPRITES[moodOf(f)], tick).map((line, i) => (
                <Text key={`c-${i}`} color={CLAWD}>{line}</Text>
              ))}
            </Box>
          ) : null}
          <Box flexDirection="column" flexGrow={1}>
            <Text color="text" bold wrap="truncate-end">
              <Text color={tone(f)}>⚒ </Text>
              {f.ticket ? `#${f.ticket} ` : ''}
              {f.title}
            </Text>
            <Text dimColor wrap="truncate-end">
              {KIND_LABEL[f.kind]}
              {f.taille ? ` · taille ${f.taille}` : ''} · {fmtTime(elapsed)}
              {list.length ? ` · ≈${fmtCost(t.cost)}` : ''}
            </Text>
            {Raster ? (
              <Box flexDirection="row" gap={1}>
                <Raster key="progress" {...raster([solidBar(ratio(f), headBar), solidBar(ratio(f), headBar)], tone(f))} />
                <Text color="text" bold>{Math.round(ratio(f) * 100)}%</Text>
              </Box>
            ) : (
              <Text color="text" wrap="truncate-end">
                <Text color={tone(f)}>{bar(ratio(f), headBar)}</Text>
                <Text color="text" bold> {Math.round(ratio(f) * 100)}%</Text>
              </Text>
            )}
            {statusWord(f) && f.status !== 'running' && (
              <Text color={tone(f)} bold>
                {statusWord(f)}
              </Text>
            )}
          </Box>
          </Box>
        )}

        {tiles}

        {f && (
          <Box flexDirection="column" marginBottom={1}>
            {sectionBar(`Étapes · ${Math.min(stages.length, f.furthest + (isFinished(f) ? 0 : 1))}/${stages.length}`, '#3B6FD9')}
            {stages.map((name, i) => {
              const [g, c] = glyph(i)
              const d = detail(i)
              const isNow = i === f.stage && !isFinished(f)
              if (isNow) {
                const hl = tone(f) === KO || (f.kind === 'build' && i === B.tester && f.gateLast === 'fail') ? KO : ACCENT
                // Le fond est porté par une Box : sur certains terminaux, celui d'un Text ne s'affiche pas.
                const label = (
                  <Box key={`now-${i}`} backgroundColor={hl} paddingX={1} flexGrow={1}>
                    <Text wrap="truncate-end" color="#1a1a1a" bold>
                      ▶ {name}
                      {d ? ` · ${d}` : ''}
                    </Text>
                  </Box>
                )
                return label
              }
              // Une clé par état (à venir, fait) : la ligne surlignée n'est pas réutilisée
              // avec sa couleur sombre, et une étape faite a sa couleur à elle.
              if (g === '○') {
                return (
                  <Text key={`todo-${i}`} wrap="truncate-end" dimColor>
                    {' '}○ {name}
                    {d ? ` · ${d}` : ''}
                  </Text>
                )
              }
              return (
                <Text key={`done-${i}`} wrap="truncate-end" color={c ?? OK}>
                  {' '}{g} {name}
                  {d ? <Text color={DONE_DETAIL}> · {d}</Text> : ''}
                </Text>
              )
            })}
            {f.prUrl && (
              <Text dimColor wrap="truncate-end">
                {f.prUrl}
              </Text>
            )}
            {f.preview && (
              <Text dimColor wrap="truncate-end">
                Aperçu : {f.preview}
              </Text>
            )}
          </Box>
        )}

        {list.length > 0 && (
          <Box flexDirection="column" marginBottom={1}>
            {running.length > 0 && sectionBar(`En cours · ${running.length}`, OK)}
            {running.map(a => agentCard(a))}
            {finished.length > 0 && sectionBar(`Terminés · ${finished.length}`, '#D9A21B', '#1a1a1a')}
            {finished.slice(0, 4).map(a => agentCard(a))}
            {finished.length > 4 && <Text dimColor>… et {finished.length - 4} de plus</Text>}
          </Box>
        )}

        {f && f.log.length > 0 && (
          <Box flexDirection="column">
            {sectionBar('Journal', '#4b5563')}
            {f.log
              .slice(-room)
              .reverse()
              .map((l, i) => (
                <Text color="text" key={`l-${i}`} wrap="truncate-end">
                  <Text dimColor>{fmtClock(l.at)} </Text>
                  <Text color={l.tone === 'ok' ? OK : l.tone === 'ko' ? KO : l.tone === 'info' ? INFO : undefined}>{l.text}</Text>
                </Text>
              ))}
          </Box>
        )}

        <Box flexDirection="row" gap={1} marginTop={1}>
          <Button key="reset" label="Effacer" variant="primary" onPress={() => update($, flow, () => null)} />
        </Box>
      </Box>
    )
  })

  // --- La barre au-dessus du prompt.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const f = await read($, flow)
    if (e.props.hasSurvey) return next(e)
    if (f === null) {
      // Aucun ticket ne tourne : la barre dit où en est le projet et quoi lancer ensuite.
      const b = await read($, board)
      if (!b || bandHidden) return next(e)
      const c = countOf(b)
      if (c.total === 0 || c.done === c.total) return next(e)
      const drawnB = await Promise.resolve(next(e)).catch(() => null)
      const belowB = drawnB && typeof drawnB === 'object' && (drawnB as { type?: string }).type !== 'engine' ? drawnB : null
      const { Box, Text, Button } = $.ui.resolve(e)
      const cols = e.props.bodyColumns || 100
      const step = nextSteps(b)[0]
      const look = step ? TICKET_LOOK[step.ticket.state] : undefined
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text color={ACCENT}>☰</Text>
            <Text color="text">Tickets</Text>
            <Text color={OK}>{bar(c.done / c.total, Math.max(6, Math.min(14, cols - 90)))}</Text>
            <Text color="text" bold>{c.done}/{c.total} faits</Text>
            {step && look ? (
              <Box flexShrink={1}>
                <Text color="text" wrap="truncate-end">
                  <Text dimColor>· </Text>
                  <Text color={look.color}>{look.glyph} </Text>
                  {step.ticket.ref} {step.ticket.title}
                  {step.command ? <Text color={ACCENT} bold> → {step.command}</Text> : <Text dimColor> · {step.text}</Text>}
                </Text>
              </Box>
            ) : (
              <Text dimColor wrap="truncate-end">· rien de libre pour l’instant</Text>
            )}
            <Button key="board-open" label="Tickets" variant="primary" onPress={() => void togglePane($, 'board')} />
            <Button key="board-dismiss" label="✕" variant="primary" role="dismiss" onPress={() => {
              bandHidden = true
              return update($, board, x => (x ? { ...x } : x))
            }} />
          </Box>
          {belowB}
        </Box>
      )
    }
    const drawn = await Promise.resolve(next(e)).catch(() => null)
    const below = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null

    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, agents)
    const at = Math.max(await read($, now), Date.now())
    const cols = e.props.bodyColumns || 100
    const tick = await read($, frame)
    const n = STAGES[f.kind].length
    const pos = isFinished(f) ? n : Math.min(n, f.stage + 1)
    const busy = list.filter(a => a.status === 'running').length
    const head = `${f.ticket ? `#${f.ticket} ` : ''}${f.title}`
    const titleW = Math.max(10, Math.min(36, head.length + 1, Math.floor(cols / 3)))
    const barW = Math.max(6, Math.min(20, cols - titleW - 60))

    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          {clawd ? <Text color={CLAWD}>{pick(MINI[moodOf(f)], tick)}</Text> : <Text color={tone(f)}>⚒</Text>}
          <Box width={titleW} flexShrink={0}>
            <Text color="text" wrap="truncate-end">{head}</Text>
          </Box>
          <Text color={tone(f)}>{bar(ratio(f), barW)}</Text>
          <Text color="text" bold>{stageLabel(f)}</Text>
          <Text dimColor>
            {pos}/{n} · {fmtTime((f.endedAt ?? at) - f.startedAt)}
            {busy ? ` · ${busy} agent${busy > 1 ? 's' : ''}` : ''}
          </Text>
          <Button key="forge-open" label="Détails" variant="primary" onPress={() => void togglePane($, 'live')} />
          <Button key="forge-dismiss" label="✕" variant="primary" role="dismiss" onPress={() => update($, flow, () => null)} />
        </Box>
        {below}
      </Box>
    )
  })
}
