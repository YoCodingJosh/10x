import os from 'node:os'

import { ipcMain } from 'electron'

/** App-level IPC registered with the rest of the main process (re-register safe for dev HMR). */
export function registerAppIpc() {
  ipcMain.removeHandler('app:getHomeDir')
  ipcMain.handle('app:getHomeDir', () => os.homedir())
}
