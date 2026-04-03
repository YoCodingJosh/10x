import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

import type { SettingsPanelProps } from '@/features/settings/settings-sections'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type UpdatePhase =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'dev' }
  | { kind: 'error'; message: string }
  | { kind: 'upToDate' }
  | { kind: 'updateAvailable'; version: string }
  | { kind: 'downloading'; percent: number }
  | { kind: 'readyToInstall' }

export function GeneralSettingsPanel(_props: SettingsPanelProps) {
  const [version, setVersion] = useState<string | null>(null)
  const [phase, setPhase] = useState<UpdatePhase>({ kind: 'idle' })

  useEffect(() => {
    void window.mux.updater.getAppVersion().then(setVersion)
  }, [])

  useEffect(() => {
    const unProgress = window.mux.updater.onDownloadProgress((p) => {
      setPhase({ kind: 'downloading', percent: Math.round(p.percent) })
    })
    const unDownloaded = window.mux.updater.onUpdateDownloaded(() => {
      setPhase({ kind: 'readyToInstall' })
    })
    const unErr = window.mux.updater.onError((e) => {
      setPhase({ kind: 'error', message: e.message })
    })
    return () => {
      unProgress()
      unDownloaded()
      unErr()
    }
  }, [])

  const check = useCallback(async () => {
    setPhase({ kind: 'checking' })
    const r = await window.mux.updater.checkForUpdates()
    if (!r.ok) {
      setPhase({ kind: 'error', message: r.error })
      return
    }
    if (!r.isPackaged) {
      setPhase({ kind: 'dev' })
      return
    }
    if (r.updateAvailable && r.latestVersion) {
      setPhase({ kind: 'updateAvailable', version: r.latestVersion })
      return
    }
    setPhase({ kind: 'upToDate' })
  }, [])

  const download = useCallback(async () => {
    setPhase({ kind: 'downloading', percent: 0 })
    const r = await window.mux.updater.downloadUpdate()
    if (!r.ok) {
      setPhase({ kind: 'error', message: r.error })
    }
  }, [])

  const restart = useCallback(() => {
    void window.mux.updater.quitAndInstall()
  }, [])

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">General</h2>
        <p className="mt-1 text-sm text-muted-foreground">App version and updates.</p>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Version</p>
        <p className="mt-1 font-mono text-sm text-foreground">{version ?? '—'}</p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={phase.kind === 'checking'}
            onClick={() => void check()}
          >
            {phase.kind === 'checking' ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            Check for updates
          </Button>
          {phase.kind === 'updateAvailable' && (
            <Button type="button" size="sm" onClick={() => void download()}>
              Download {phase.version}
            </Button>
          )}
          {phase.kind === 'readyToInstall' && (
            <Button type="button" size="sm" onClick={restart}>
              Restart and update
            </Button>
          )}
        </div>

        {phase.kind === 'downloading' && (
          <div className="space-y-1">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-300"
                style={{ width: `${phase.percent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">Downloading… {phase.percent}%</p>
          </div>
        )}

        <p
          className={cn(
            'text-sm',
            phase.kind === 'error' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {phase.kind === 'idle' && 'See if a newer build is available on GitHub.'}
          {phase.kind === 'checking' && 'Checking…'}
          {phase.kind === 'dev' && 'Updates are available in the packaged app (not in dev mode).'}
          {phase.kind === 'upToDate' && "You're on the latest release."}
          {phase.kind === 'updateAvailable' && `Version ${phase.version} is available.`}
          {phase.kind === 'error' && phase.message}
          {phase.kind === 'readyToInstall' && 'Update downloaded. Restart to finish installing.'}
        </p>
      </div>
    </div>
  )
}
