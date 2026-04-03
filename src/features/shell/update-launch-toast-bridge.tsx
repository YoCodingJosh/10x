import { useEffect } from 'react'
import { toast } from 'sonner'

const TOAST_ID = '10x-update-available'
/** Skip showing the same version again until the next app session after "Later". */
const SESSION_DISMISS = '10x.dismissedUpdateVersion'
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
        const latestVersion = r.latestVersion
        if (sessionStorage.getItem(SESSION_DISMISS) === latestVersion) return

        toast('A new version of 10x is available', {
          id: TOAST_ID,
          description: `${latestVersion} is ready — you're on ${r.currentVersion}.`,
          duration: Infinity,
          action: {
            label: 'Download',
            onClick: () => void startDownload(),
          },
          cancel: {
            label: 'Later',
            onClick: () => {
              sessionStorage.setItem(SESSION_DISMISS, latestVersion)
            },
          },
        })
      } catch {
        /* ignore startup check failures (offline, etc.) */
      }
    }

    async function startDownload() {
      toast.dismiss(TOAST_ID)
      const loadingId = toast.loading('Downloading update…')
      try {
        const res = await window.mux.updater.downloadUpdate()
        if (!res.ok) throw new Error(res.error)
        toast.dismiss(loadingId)
        toast('Restart to finish updating', {
          id: '10x-update-restart',
          description: '10x will close and reopen with the new version.',
          duration: Infinity,
          cancel: {
            label: 'Later',
            onClick: () => {},
          },
          action: {
            label: 'Restart now',
            onClick: () => void window.mux.updater.quitAndInstall(),
          },
        })
      } catch (e) {
        toast.dismiss(loadingId)
        toast.error(e instanceof Error ? e.message : 'Download failed', { duration: 10_000 })
      }
    }

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  return null
}
