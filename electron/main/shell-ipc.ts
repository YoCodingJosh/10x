import { shell, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

type OkOrErr = { ok: true } | { ok: false; error: string }

export function registerShellIpc() {
  ipcMain.handle('shell:openPathInOsFinder', async (_e: IpcMainInvokeEvent, fullPath: string) => {
    if (typeof fullPath !== 'string' || !fullPath.trim()) {
      return { ok: false, error: 'Invalid path.' }
    }
    const p = fullPath.trim()
    if (!existsSync(p)) {
      return { ok: false, error: 'Path does not exist.' }
    }
    const err = await shell.openPath(p)
    if (err) {
      return { ok: false, error: err }
    }
    return { ok: true }
  })

  ipcMain.handle('shell:openInCursor', async (_e: IpcMainInvokeEvent, folderPath: string) => {
    if (typeof folderPath !== 'string' || !folderPath.trim()) {
      return { ok: false, error: 'Invalid path.' }
    }
    const p = folderPath.trim()
    if (!existsSync(p)) {
      return { ok: false, error: 'Path does not exist.' }
    }

    return await new Promise<OkOrErr>((resolve) => {
      const child = spawn('cursor', [p], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env },
      })

      let settled = false
      const doneOk = () => {
        if (settled) return
        settled = true
        child.removeAllListeners()
        resolve({ ok: true })
      }
      const doneErr = (msg: string) => {
        if (settled) return
        settled = true
        child.removeAllListeners()
        resolve({ ok: false, error: msg })
      }

      child.on('error', (err) => {
        doneErr(
          `Could not run \`cursor\`: ${err.message}. Install the Cursor CLI and ensure it is on your PATH.`,
        )
      })

      child.on('spawn', () => {
        child.unref()
        doneOk()
      })

      setTimeout(() => {
        if (!settled) {
          child.unref()
          doneOk()
        }
      }, 600)
    })
  })
}
