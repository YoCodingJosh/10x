import type { SettingsPanelProps } from '@/features/settings/settings-sections'
import { GithubAuthConnectSection } from '@/features/github/github-auth-connect-section'
import { useGithubDeviceAuth } from '@/features/github/use-github-device-auth'

export function GithubSettingsPanel(_props: SettingsPanelProps) {
  const auth = useGithubDeviceAuth()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">GitHub</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to create repos and push from the Git menu. Publishing a new repo without{' '}
          <code className="rounded bg-muted px-1">origin</code> is in the activity bar → Git → Publish to GitHub.
        </p>
      </div>

      <GithubAuthConnectSection auth={auth} />

      <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-4 text-[11px]">
        <button
          type="button"
          className="text-primary underline-offset-2 hover:underline"
          onClick={() => void window.mux.github.openNewRepoPage()}
        >
          Open github.com/new
        </button>
      </div>
    </div>
  )
}
