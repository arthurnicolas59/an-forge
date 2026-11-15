export type FlowKind = 'build' | 'launch' | 'quick'

export type FlowStatus = 'running' | 'waiting' | 'needs-info' | 'stopped' | 'merged' | 'done'

export type LogEntry = { at: number; text: string; tone?: 'ok' | 'ko' | 'info' }

export type Flow = {
  kind: FlowKind
  /** Étape en cours (index dans la liste des étapes du type de flux). */
  stage: number
  /** Étape la plus avancée atteinte : c'est elle qui remplit la barre. */
  furthest: number
  status: FlowStatus
  ticket?: number
  title: string
  branch?: string
  worktree?: string
  base?: string
  taille?: string
  buildModel?: string
  reviewModel?: string
  gatePass: number
  gateFail: number
  gateLast?: 'pass' | 'fail'
  reviewRound: number
  checks?: string
  pr?: number
  prUrl?: string
  preview?: string
  spec?: number
  issues: number[]
  startedAt: number
  endedAt?: number
  log: LogEntry[]
}

export type AgentStatus = 'running' | 'done' | 'failed'

export type AgentRun = {
  id: string
  agentId?: string
  role: string
  type: string
  description: string
  model: string
  status: AgentStatus
  startedAt: number
  endedAt?: number
  tokens: number
  costUsd: number
  steps: number
  /** Nombre d'outils appelés par l'agent : son « étape ». */
  actions?: number
  /** Ce qu'il fait en ce moment (« Lit research.md »). */
  current?: string
  /** Ses actions précédentes, la plus récente d'abord. */
  recent?: string[]
}

/** Où en est un ticket, vu du tableau. */
export type TicketState =
  | 'done' // fermé, ou Status: done
  | 'review' // une PR ouverte attend ta décision
  | 'building' // pris par une session (assigné ou branche ticket/<n>-…)
  | 'question' // needs-info : une question t'attend
  | 'human' // ready-for-human : construction arrêtée
  | 'ready' // libre : peut être construit maintenant
  | 'waiting' // attend d'autres tickets
  | 'draft' // pas encore ready-for-agent

export type BoardTicket = {
  n: number
  /** Comme on l'écrit : « #12 » sur GitHub, « 02 » en local. */
  ref: string
  title: string
  state: TicketState
  /** Les tickets pas encore faits qui le bloquent. */
  waitsOn: number[]
  pr?: number
  taille?: string
  /** Unique sur le tableau : « <spec>|<ticket> » (en local, deux specs ont chacune leur 01). */
  key?: string
  /** Ce qu'il faut construire, tiré du ticket, en texte brut (pour la phrase d'objectif). */
  about?: string
}

export type BoardSpec = { n?: number; ref: string; title: string; isOpen: boolean; tickets: BoardTicket[] }

export type Board = {
  source: 'github' | 'local'
  /** owner/repo, ou .scratch */
  where: string
  specs: BoardSpec[]
  loadedAt: number
  error?: string
}

export type View = 'live' | 'board'

declare module 'claude-code' {
  interface PluginState {
    'forge-progress': {
      flow: Shaped<Flow | null>
      agents: Shaped<AgentRun[]>
      now: number
      /** Image de l'animation de Clawd. */
      frame: number
      /** Le tableau des tickets du projet, null tant qu'il n'est pas lu (ou hors projet an-forge). */
      board: Shaped<Board | null>
      /** Un chargement du tableau est en cours. */
      boardLoading: boolean
      /** Ce que montre le panneau : le ticket en cours, ou les tickets du projet. */
      view: View
      /** Le ticket déplié dans le tableau (sa clé), ou null. */
      opened: string | null
      /** La phrase d'objectif de chaque ticket déjà demandé, par clé ; '' pendant qu'elle s'écrit. */
      goals: Shaped<Record<string, string>>
    }
  }
}
