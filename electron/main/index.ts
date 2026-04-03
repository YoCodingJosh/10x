import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import Store from 'electron-store'

import { registerGithubIpc } from './github-ipc'
import { registerAgentAttentionIpc } from './notification-manager'
import { registerGitIpc } from './git-ipc'
import { loadEnvFromAppRoot } from './load-env'
import { killAllPtySessions, registerPtyIpc } from './pty-manager'
import { registerShellIpc } from './shell-ipc'
import { registerUpdaterIpc } from './updater-ipc'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type WorkspaceEntry = { id: string; path: string; label: string }

type TenxStoreSchema = {
  workspaces: WorkspaceEntry[]
}

const store = new Store<TenxStoreSchema>({
  defaults: {
    workspaces: [],
  },
})

process.env.APP_ROOT = path.join(__dirname, '../..')
loadEnvFromAppRoot(process.env.APP_ROOT)

const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let mainWindow: BrowserWindow | null = null

const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

function createWindow() {
  mainWindow = new BrowserWindow({
    title: '10x',
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 560,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(indexHtml)
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}

ipcMain.handle('store:get', <K extends keyof TenxStoreSchema>(_event: IpcMainInvokeEvent, key: K) =>
  store.get(key),
)

ipcMain.handle(
  'store:set',
  <K extends keyof TenxStoreSchema>(
    _event: IpcMainInvokeEvent,
    key: K,
    value: TenxStoreSchema[K],
  ) => {
    store.set(key, value)
    return true
  },
)

registerPtyIpc()
registerAgentAttentionIpc()
registerGitIpc()
registerGithubIpc()
registerShellIpc()
registerUpdaterIpc()

ipcMain.handle('dialog:pickWorkspace', async (event) => {
  const parent =
    BrowserWindow.fromWebContents(event.sender) ??
    mainWindow ??
    BrowserWindow.getAllWindows()[0]
  if (!parent) return null
  const { canceled, filePaths } = await dialog.showOpenDialog(parent, {
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || filePaths.length === 0) return null
  return filePaths[0]
})

app.whenReady().then(() => {
  createWindow()
})

app.on('before-quit', () => {
  killAllPtySessions()
})

app.on('window-all-closed', () => {
  mainWindow = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})
