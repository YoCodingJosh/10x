import { useStatusActivityStore } from '@/stores/status-activity-store'
import type { StatusDomain } from '@/stores/status-activity-store'

type Input = {
  domain: StatusDomain
  label: string
  detail?: string
  id?: string
}

/**
 * Shows a status-bar activity for the duration of `fn`. Use from anywhere (not React-only).
 */
export async function runWithStatusActivity<T>(input: Input, fn: () => Promise<T>): Promise<T> {
  const end = useStatusActivityStore.getState().begin(input)
  try {
    return await fn()
  } finally {
    end()
  }
}
