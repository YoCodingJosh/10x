import { create } from 'zustand'

/** Built-in domains get icons in the status bar; use custom strings for new areas. */
export type StatusDomain =
  | 'git'
  | 'github'
  | 'shell'
  | 'sync'
  /** Escape hatch — prefer adding a known domain + icon when something becomes common. */
  | (string & {})

export type StatusActivity = {
  id: string
  domain: StatusDomain
  /** Short line shown in the bar (e.g. “Pushing…”). */
  label: string
  /** Optional tooltip (path, branch name, …). */
  detail?: string
}

function newActivityId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `act-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type StatusActivityState = {
  activities: StatusActivity[]
  /**
   * Registers a visible activity; call the returned function when the work finishes
   * (success or failure). Safe to call multiple times; only the first end applies.
   */
  begin: (input: {
    domain: StatusDomain
    label: string
    detail?: string
    /** Stable id if the same logical task can restart (dedupe UI). */
    id?: string
  }) => () => void
}

export const useStatusActivityStore = create<StatusActivityState>((set) => ({
  activities: [],
  begin: ({ domain, label, detail, id: preferredId }) => {
    const id = preferredId ?? newActivityId()
    const entry: StatusActivity = { id, domain, label, detail }
    set((s) => ({ activities: [...s.activities.filter((a) => a.id !== id), entry] }))
    let ended = false
    return () => {
      if (ended) return
      ended = true
      set((s) => ({ activities: s.activities.filter((a) => a.id !== id) }))
    }
  },
}))
