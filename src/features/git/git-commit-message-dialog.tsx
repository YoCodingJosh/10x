import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  cwd: string | null
  description?: string
  onCommit: (message: string) => void | Promise<void>
}

export function GitCommitMessageDialog({
  open,
  onOpenChange,
  cwd,
  description = 'Staged changes will be committed in the active checkout. Use “Stage all” first if you want everything included.',
  onCommit,
}: Props) {
  const [commitMessage, setCommitMessage] = useState('')

  useEffect(() => {
    if (!open) setCommitMessage('')
  }, [open])

  async function submit() {
    const msg = commitMessage.trim()
    if (!msg || !cwd) return
    setCommitMessage('')
    onOpenChange(false)
    await onCommit(msg)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3">
        <DialogTitle>Commit</DialogTitle>
        <DialogDescription className="text-xs">{description}</DialogDescription>
        <textarea
          className={cn(
            'min-h-[88px] w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm',
            'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
          )}
          placeholder="Commit message"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          autoFocus
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void submit()} disabled={!commitMessage.trim() || !cwd}>
            Commit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
