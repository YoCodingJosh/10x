import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'

export type WorktreeNameDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  /** Resolve `true` when done and the dialog should close. */
  onConfirm: (worktreeName: string) => Promise<boolean>
  error?: string | null
}

export function WorktreeNameDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Create worktree',
  onConfirm,
  error: externalError,
}: WorktreeNameDialogProps) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName('')
      setBusy(false)
      setLocalError(null)
    }
  }, [open])

  const displayError = externalError ?? localError

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed) {
      setLocalError('Enter a name.')
      return
    }
    setBusy(true)
    setLocalError(null)
    try {
      const success = await onConfirm(trimmed)
      setBusy(false)
      if (success) onOpenChange(false)
    } catch {
      setLocalError('Something went wrong.')
      setBusy(false)
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
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        <div className="grid gap-2">
          <label htmlFor="mux-worktree-name" className="text-xs font-medium text-foreground">
            Worktree name
          </label>
          <input
            id="mux-worktree-name"
            autoFocus
            value={name}
            disabled={busy}
            placeholder="e.g. feature-auth"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void submit()
              }
            }}
          />
          {displayError ? (
            <p className="text-xs text-destructive">{displayError}</p>
          ) : null}
        </div>
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
          <Button type="button" size="sm" disabled={busy} onClick={() => void submit()}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
