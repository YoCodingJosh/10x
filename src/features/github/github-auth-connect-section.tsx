import { Button } from '@/components/ui/button'
import type { GithubDeviceAuth } from '@/features/github/use-github-device-auth'
import { ExternalLink } from 'lucide-react'

type Auth = GithubDeviceAuth

type Props = {
  auth: Auth
  /** When false, hide the signed-in / Sign out row (publish modal renders the form instead). */
  showSignedInRow?: boolean
}

/**
 * Shared “Connect to GitHub” UI (device flow) + optional signed-in / Sign out row.
 */
export function GithubAuthConnectSection({ auth, showSignedInRow = true }: Props) {
  const {
    githubLogin,
    loadingStatus,
    deviceStep,
    polling,
    refreshGithub,
    startGithubConnect,
    cancelDeviceLogin,
    signOutGithub,
  } = auth

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Connect your account in the browser with a one-time code. Only an access token is stored after you
        authorize.
      </p>

      {loadingStatus ? (
        <p className="text-xs text-muted-foreground">Loading connection…</p>
      ) : null}

      {!loadingStatus && githubLogin && showSignedInRow ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">
            Signed in as <span className="font-medium text-foreground">@{githubLogin}</span>
          </span>
          <Button type="button" size="sm" variant="outline" onClick={() => void signOutGithub()}>
            Sign out
          </Button>
        </div>
      ) : null}

      {!loadingStatus && !githubLogin && !polling ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => void startGithubConnect()}>
            Connect to GitHub
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => void refreshGithub()}>
            Refresh
          </Button>
        </div>
      ) : null}

      {deviceStep.kind === 'error' ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
          {deviceStep.message}
        </p>
      ) : null}

      {deviceStep.kind === 'polling' ? (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Complete sign-in on GitHub with this code (a browser tab should have opened):
          </p>
          <p className="text-center font-mono text-lg tracking-widest text-foreground">{deviceStep.userCode}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="gap-1"
              onClick={() =>
                window.open(deviceStep.verificationUriComplete, '_blank', 'noopener,noreferrer')
              }
            >
              <ExternalLink className="size-3.5" />
              Open GitHub
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={cancelDeviceLogin}>
              Cancel
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Waiting for authorization…</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        <button
          type="button"
          className="text-primary underline-offset-2 hover:underline"
          onClick={() => void window.mux.github.openDeviceHelp()}
        >
          How device sign-in works
        </button>
      </div>
    </div>
  )
}
