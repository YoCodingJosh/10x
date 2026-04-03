import { useEffect } from 'react'

import { openUpdateAvailableToast } from '@/features/updater/update-toasts'

const LAUNCH_DELAY_MS = 1200

/**
 * On startup (packaged app only), checks GitHub for a newer release and shows a toast
 * with Download / Later, then Restart when the update is downloaded — similar to Cursor.
 */
export function UpdateLaunchToastBridge() {
  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => void check(), LAUNCH_DELAY_MS)

    async function check() {
      try {
        const r = await window.mux.updater.checkForUpdates()
        if (cancelled) return
        if (!r.ok || !r.isPackaged || !r.updateAvailable || !r.latestVersion) return
        openUpdateAvailableToast({
          currentVersion: r.currentVersion,
          latestVersion: r.latestVersion,
          respectSessionDismiss: true,
        })
      } catch {
        /* ignore startup check failures (offline, etc.) */
      }
    }

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  return null
}
