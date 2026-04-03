import { BrowserWindow, app, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

function broadcast(channel: string, payload?: unknown) {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send(channel, payload)
  }
}

export function registerUpdaterIpc() {
  autoUpdater.autoDownload = false
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
    broadcast('updater:error', { message: err.message })
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
      const message = e instanceof Error ? e.message : String(e)
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
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
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
