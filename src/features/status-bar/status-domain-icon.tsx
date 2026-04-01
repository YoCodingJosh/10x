import type { StatusDomain } from '@/stores/status-activity-store'
import { Circle, GitBranch, Github, RefreshCw, Terminal } from 'lucide-react'

const ICON_CLASS = 'size-3.5 shrink-0 text-muted-foreground'

export function StatusDomainIcon({ domain }: { domain: StatusDomain }) {
  switch (domain) {
    case 'git':
      return <GitBranch className={ICON_CLASS} aria-hidden />
    case 'github':
      return <Github className={ICON_CLASS} aria-hidden />
    case 'shell':
      return <Terminal className={ICON_CLASS} aria-hidden />
    case 'sync':
      return <RefreshCw className={`${ICON_CLASS} animate-spin`} aria-hidden />
    default:
      return <Circle className={`${ICON_CLASS} opacity-60`} aria-hidden />
  }
}
