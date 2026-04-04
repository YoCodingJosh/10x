import {
  type AgentSessionActivity,
  agentActivityBadgeClass,
  agentActivityLabel,
  agentRailDoneBadgeClass,
  agentRailStartingBadgeClass,
} from '@/stores/agent-notification-store'
import { cn } from '@/lib/utils'

export function AgentActivityBadge({
  state,
  railIdleText,
  hasReceivedInput = false,
  className,
}: {
  state: AgentSessionActivity | null | undefined
  railIdleText?: 'DONE' | 'IDLE'
  /** From main process; false until the user has typed in that agent session. */
  hasReceivedInput?: boolean
  className?: string
}) {
  if (state == null) return null

  let text: string
  let colorClass: string
  if (state === 'running' && !hasReceivedInput) {
    text = 'STARTING'
    colorClass = agentRailStartingBadgeClass
  } else if (state === 'idle') {
    text = railIdleText ?? 'IDLE'
    colorClass =
      railIdleText === 'DONE' ? agentRailDoneBadgeClass : agentActivityBadgeClass('idle')
  } else {
    text = agentActivityLabel(state)
    colorClass = agentActivityBadgeClass(state)
  }

  return (
    <span
      className={cn(
        'inline-flex max-w-full shrink-0 truncate rounded px-1 py-px text-[9px] font-semibold leading-none tracking-wide',
        colorClass,
        className,
      )}
      title={text}
    >
      {text}
    </span>
  )
}
