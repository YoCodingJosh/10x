import { Button } from '@/components/ui/button'
import { Bot, SquareTerminal } from 'lucide-react'

export function ActivityBar() {
  return (
    <aside
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-2"
      aria-label="Activity bar"
    >
      <Button type="button" variant="ghost" size="icon-sm" title="Agents">
        <Bot className="size-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon-sm" title="Terminal">
        <SquareTerminal className="size-4" />
      </Button>
    </aside>
  )
}
