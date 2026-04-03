import { BrowserWindow, app, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'

/** CJS package — use default import so ESM main bundle loads correctly at runtime. */
const { autoUpdater } = electronUpdater

/** Release tag exists but CI has not uploaded `latest-*.yml` / blockmap yet (GitHub 404). */
function friendlyUpdaterMessage(raw: string): string {
  if (
    /latest-mac\.yml|latest-linux\.yml|latest\.yml/i.test(raw) &&
    (/\b404\b|Cannot find|Not Found|HttpError/i.test(raw) || /status code 404/i.test(raw))
  ) {
    return 'Fresh build in progress — please wait a few minutes and try again.'
  }
  return raw
}

function broadcast(channel: string, payload?: unknown) {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(channel, payload)
  }
}

export function registerUpdaterIpc() {
  autoUpdater.autoDownload = false
  /** Required on macOS for manual `downloadUpdate` + `quitAndInstall`: see electron-builder#7279 / MacUpdater.quitAndInstall(). */
  autoUpdater.autoInstallOnAppQuit = false
  autoUpdater.allowPrerelease = false

  autoUpdater.on('download-progress', (progress) => {
    broadcast('updater:download-progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', () => {
    broadcast('updater:update-downloaded')
  })

  autoUpdater.on('error', (err) => {
    broadcast('updater:error', { message: friendlyUpdaterMessage(err.message) })
  })

  ipcMain.handle('app:getVersion', () => app.getVersion())

  ipcMain.handle('updater:checkForUpdates', async () => {
    const currentVersion = app.getVersion()
    if (!app.isPackaged) {
      return { ok: true as const, isPackaged: false, currentVersion }
    }
    try {
      const result = await autoUpdater.checkForUpdates()
      const updateAvailable = result?.isUpdateAvailable === true
      const latestVersion = result?.updateInfo?.version
      return {
        ok: true as const,
        isPackaged: true,
        currentVersion,
        updateAvailable,
        latestVersion: updateAvailable ? latestVersion : undefined,
      }
    } catch (e) {
      const message = friendlyUpdaterMessage(e instanceof Error ? e.message : String(e))
      return { ok: false as const, currentVersion, error: message }
    }
  })

  ipcMain.handle('updater:downloadUpdate', async () => {
    if (!app.isPackaged) {
      return { ok: false as const, error: 'Updates are only available in the installed app.' }
    }
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true as const }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e)
      return { ok: false as const, error: friendlyUpdaterMessage(raw) }
    }
  })

  ipcMain.handle('updater:quitAndInstall', () => {
    if (!app.isPackaged) {
      return { ok: false as const, error: 'Not a packaged build.' }
    }
    setImmediate(() => autoUpdater.quitAndInstall(false, true))
    return { ok: true as const }
  })
}
