import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Github, Settings } from 'lucide-react'

import { GeneralSettingsPanel } from '@/features/settings/settings-panels/general-settings-panel'
import { GithubSettingsPanel } from '@/features/settings/settings-panels/github-settings-panel'

export type SettingsSectionId = 'general' | 'github'

export type SettingsPanelProps = {
  /** Visible workspace checkout (Git menu / publish target). */
  gitCwd: string | null
}

export type SettingsSectionDefinition = {
  id: SettingsSectionId
  label: string
  icon: LucideIcon
  Panel: (props: SettingsPanelProps) => ReactNode
}

/**
 * Single registry for Settings sidebar + panels. Add entries here when new sections ship.
 */
export const SETTINGS_SECTIONS: readonly SettingsSectionDefinition[] = [
  { id: 'general', label: 'General', icon: Settings, Panel: GeneralSettingsPanel },
  { id: 'github', label: 'GitHub', icon: Github, Panel: GithubSettingsPanel },
]
