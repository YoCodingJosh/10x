import type { SettingsPanelProps } from '@/features/settings/settings-sections'

export function GeneralSettingsPanel(_props: SettingsPanelProps) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-foreground">General</h2>
        <p className="mt-1 text-sm text-muted-foreground">Big fat stinking todo.</p>
      </div>
      <p className="text-xs text-muted-foreground">Nothing to configure yet.</p>
    </div>
  )
}
