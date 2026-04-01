import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'

export type CloseAgentWorktreeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  agentLabel: string
  worktreePath: string
  onConfirmRemove: () => Promise<{ ok: true } | { ok: false; error: string }>
}

export function CloseAgentWorktreeDialog({
  open,
  onOpenChange,
  agentLabel,
  worktreePath,
  onConfirmRemove,
}: CloseAgentWorktreeDialogProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setBusy(false)
      setError(null)
    }
  }, [open])

  async function confirm() {
    setBusy(true)
    setError(null)
    const result = await onConfirmRemove()
    setBusy(false)
    if (result.ok) {
      onOpenChange(false)
    } else {
      setError(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <DialogTitle>Remove agent and worktree?</DialogTitle>
        <DialogDescription asChild>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              This closes <span className="font-medium text-foreground">{agentLabel}</span> and{' '}
              <strong className="text-foreground">deletes</strong> the Git worktree on disk, including
              uncommitted changes. The linked branch under <code className="text-xs">mux/</code> is
              removed when Git allows it.
            </p>
            <p className="break-all rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-foreground/90">
              {worktreePath}
            </p>
          </div>
        </DialogDescription>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={busy}
            onClick={() => void confirm()}
          >
            {busy ? 'Removing…' : 'Remove worktree'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
