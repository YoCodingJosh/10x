import { app, BrowserWindow, ipcMain, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import Store from 'electron-store'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type WorkspaceEntry = { id: string; path: string; label: string }

type MuxStoreSchema = {
  workspaces: WorkspaceEntry[]
}

const store = new Store<MuxStoreSchema>({
  defaults: {
    workspaces: [],
  },
})

process.env.APP_ROOT = path.join(__dirname, '../..')

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
    title: 'Mux',
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

ipcMain.handle('store:get', <K extends keyof MuxStoreSchema>(_, key: K) => store.get(key))

ipcMain.handle(
  'store:set',
  <K extends keyof MuxStoreSchema>(_, key: K, value: MuxStoreSchema[K]) => {
    store.set(key, value)
    return true
  },
)

app.whenReady().then(() => {
  createWindow()
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
