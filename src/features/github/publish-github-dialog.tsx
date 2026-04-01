import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import { GithubAuthConnectSection } from '@/features/github/github-auth-connect-section'
import { useGithubDeviceAuth } from '@/features/github/use-github-device-auth'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  gitCwd: string | null
  onPublished?: () => void
}

export function PublishGithubDialog({ open, onOpenChange, gitCwd, onPublished }: Props) {
  const auth = useGithubDeviceAuth({ fetchOnMount: false })
  const { stopPolling, resetDeviceError, refreshGithub } = auth

  const [repoName, setRepoName] = useState('')
  const [repoDesc, setRepoDesc] = useState('')
  const [repoPrivate, setRepoPrivate] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) void refreshGithub()
    else {
      stopPolling()
      resetDeviceError()
      setRepoName('')
      setRepoDesc('')
      setRepoPrivate(false)
    }
  }, [open, stopPolling, resetDeviceError, refreshGithub])

  const canShowForm =
    !auth.loadingStatus && auth.githubLogin && auth.deviceStep.kind === 'idle'

  async function submit() {
    if (!gitCwd || !repoName.trim() || !auth.githubLogin) return
    setBusy(true)
    try {
      const r = await window.mux.github.createRepoAndLink({
        cwd: gitCwd,
        name: repoName.trim(),
        description: repoDesc.trim() || undefined,
        private: repoPrivate,
      })
      if (!r.ok) {
        window.alert(r.error)
        return
      }
      window.alert(`Linked \`origin\` to ${r.html_url}. You can push from the Git menu.`)
      onOpenChange(false)
      onPublished?.()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-4 overflow-y-auto sm:max-w-md">
        <DialogTitle>Publish to GitHub</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Create a new repository on your account and add it as <code className="rounded bg-muted px-1">origin</code>{' '}
          for the folder below.
        </DialogDescription>

        {gitCwd ? (
          <p className="truncate font-mono text-[10px] text-muted-foreground" title={gitCwd}>
            {gitCwd}
          </p>
        ) : (
          <p className="text-xs text-amber-600/90">Add a workspace to use this flow.</p>
        )}

        {!canShowForm ? (
          <GithubAuthConnectSection auth={auth} showSignedInRow={false} />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2">
              <label className="grid gap-0.5 text-xs">
                <span className="text-muted-foreground">Repository name</span>
                <input
                  className={cn(
                    'rounded-md border border-border bg-background px-2 py-1.5 text-sm',
                    'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
                  )}
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-app"
                  disabled={!gitCwd || busy}
                />
              </label>
              <label className="grid gap-0.5 text-xs">
                <span className="text-muted-foreground">Description (optional)</span>
                <input
                  className={cn(
                    'rounded-md border border-border bg-background px-2 py-1.5 text-sm',
                    'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
                  )}
                  value={repoDesc}
                  onChange={(e) => setRepoDesc(e.target.value)}
                  disabled={!gitCwd || busy}
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={repoPrivate}
                  onChange={(e) => setRepoPrivate(e.target.checked)}
                  disabled={!gitCwd || busy}
                />
                Private repository
              </label>
            </div>
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!gitCwd || !repoName.trim() || busy}
                onClick={() => void submit()}
              >
                {busy ? 'Creating…' : 'Create repository & link origin'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
