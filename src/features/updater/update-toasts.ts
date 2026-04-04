import { toast } from 'sonner'

import { FRIENDLY_UPDATER_BUILD_IN_PROGRESS_MESSAGE } from '@/features/updater/updater-messages'

export const UPDATE_AVAILABLE_TOAST_ID = '10x-update-available'
export const UPDATE_RESTART_TOAST_ID = '10x-update-restart'

const SESSION_DISMISS = '10x.dismissedUpdateVersion'

function toastUpdaterFailure(message: string, duration: number) {
  /** CI still publishing — avoid alarming toasts; same as “no update” from the user’s perspective. */
  if (message === FRIENDLY_UPDATER_BUILD_IN_PROGRESS_MESSAGE) return
  toast.error(message, { duration })
}

type OpenUpdateArgs = {
  currentVersion: string
  latestVersion: string
  /** Startup toast honors "Later" for this version; manual version click always offers the update. */
  respectSessionDismiss: boolean
}

export function openUpdateAvailableToast({ currentVersion, latestVersion, respectSessionDismiss }: OpenUpdateArgs): boolean {
  if (respectSessionDismiss && sessionStorage.getItem(SESSION_DISMISS) === latestVersion) {
    return false
  }

  toast('A new version of 10x is available', {
    id: UPDATE_AVAILABLE_TOAST_ID,
    description: `${latestVersion} is ready — you're on ${currentVersion}.`,
    duration: Infinity,
    action: {
      label: 'Download',
      onClick: () => void startDownloadAndShowRestartToast(),
    },
    cancel: {
      label: 'Later',
      onClick: () => {
        sessionStorage.setItem(SESSION_DISMISS, latestVersion)
      },
    },
  })
  return true
}

export async function startDownloadAndShowRestartToast() {
  toast.dismiss(UPDATE_AVAILABLE_TOAST_ID)
  const loadingId = toast.loading('Downloading update…')
  try {
    const res = await window.mux.updater.downloadUpdate()
    if (!res.ok) throw new Error(res.error)
    toast.dismiss(loadingId)
    toast('Restart to finish updating', {
      id: UPDATE_RESTART_TOAST_ID,
      description: 'The app will quit and reopen.',
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
    const msg = e instanceof Error ? e.message : 'Download failed'
    toastUpdaterFailure(msg, 10_000)
  }
}

/**
 * Check for updates and show a toast: up to date, update available, dev / error.
 * Used when the user explicitly checks (e.g. clicks the version in the status bar).
 */
export async function toastResultOfManualUpdateCheck() {
  const loadingId = toast.loading('Checking for updates…')
  try {
    const r = await window.mux.updater.checkForUpdates()
    toast.dismiss(loadingId)
    if (!r.ok) {
      toastUpdaterFailure(r.error, 7_000)
      return
    }
    if (!r.isPackaged) {
      toast('Updates in the packaged app', {
        description: 'This dev build does not receive GitHub releases. Install a release build to get updates.',
        duration: 3000,
      })
      return
    }
    if (r.updateAvailable && r.latestVersion) {
      openUpdateAvailableToast({
        currentVersion: r.currentVersion,
        latestVersion: r.latestVersion,
        respectSessionDismiss: false,
      })
      return
    }
    toast("You're up to date", {
      description: `${r.currentVersion} is the latest release.`,
      duration: 3000,
    })
  } catch {
    toast.dismiss(loadingId)
    toast.error('Could not check for updates.', { duration: 3000 })
  }
}
