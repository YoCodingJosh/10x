import {
  type AgentSessionActivity,
  agentActivityBadgeClass,
  agentActivityLabel,
  agentRailDoneBadgeClass,
} from '@/stores/agent-notification-store'
import { cn } from '@/lib/utils'

export function AgentActivityBadge({
  state,
  railIdleText,
  className,
}: {
  state: AgentSessionActivity | null | undefined
  /** When `state` is idle: DONE (violet) vs IDLE (green, dismissed). */
  railIdleText?: 'DONE' | 'IDLE'
  className?: string
}) {
  if (state == null) return null
  const text =
    state === 'idle' ? (railIdleText ?? 'IDLE') : agentActivityLabel(state)
  const colorClass =
    state === 'idle' && railIdleText === 'DONE'
      ? agentRailDoneBadgeClass
      : agentActivityBadgeClass(state)
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
