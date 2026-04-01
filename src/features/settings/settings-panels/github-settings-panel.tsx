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
    </div>
  )
}
