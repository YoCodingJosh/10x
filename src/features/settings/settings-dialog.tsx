import { useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from '@/features/settings/settings-sections'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsDialog({ open, onOpenChange }: Props) {
  const gitCwd = useGitCwdForVisibleWorkspace()
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('general')

  useEffect(() => {
    if (!open) {
      setActiveSection('general')
    }
  }, [open])

  const def = SETTINGS_SECTIONS.find((s) => s.id === activeSection) ?? SETTINGS_SECTIONS[0]
  const Panel = def.Panel

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <div className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base font-semibold">Settings</DialogTitle>
          <DialogDescription className="sr-only">Application preferences and integrations</DialogDescription>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1">
          <nav
            aria-label="Settings sections"
            className="flex w-44 shrink-0 flex-col gap-0.5 border-r border-border bg-muted/15 p-2"
          >
            {SETTINGS_SECTIONS.map((s) => {
              const active = s.id === activeSection
              const Icon = s.icon
              return (
                <button
                  key={s.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors',
                    active
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground',
                  )}
                  onClick={() => setActiveSection(s.id)}
                >
                  <Icon className="size-4 shrink-0 opacity-80" aria-hidden />
                  <span className="min-w-0 truncate">{s.label}</span>
                </button>
              )
            })}
          </nav>

          <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5">
            <div key={def.id}>
              <Panel gitCwd={gitCwd} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
