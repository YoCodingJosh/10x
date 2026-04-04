import { shell, ipcMain } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'

type OkOrErr = { ok: true } | { ok: false; error: string }

const NEITHER_EDITOR_CLI_MSG =
  'Could not open the folder in Cursor or VS Code: neither the `cursor` nor the `code` shell command is available in your PATH. Install the Cursor or VS Code CLI (Cursor: install shell command; VS Code: Command Palette → Shell Command: Install code command in PATH) and try again.'

/**
 * Try to open a folder via a CLI (`cursor` or `code` style). Resolves on successful spawn
 * (same timing heuristic as before: spawn event or short timeout).
 */
function tryOpenFolderWithEditorCli(command: string, folderPath: string): Promise<OkOrErr> {
  return new Promise((resolve) => {
    const child = spawn(command, [folderPath], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env },
    })

    let settled = false
    const finish = (result: OkOrErr) => {
      if (settled) return
      settled = true
      child.removeAllListeners()
      resolve(result)
    }

    child.on('error', () => {
      finish({ ok: false, error: `${command}` })
    })

    child.on('spawn', () => {
      child.unref()
      finish({ ok: true })
    })

    setTimeout(() => {
      if (!settled) {
        child.unref()
        finish({ ok: true })
      }
    }, 600)
  })
}

export function registerShellIpc() {
  ipcMain.handle('shell:openExternal', async (_e: IpcMainInvokeEvent, url: unknown) => {
    if (typeof url !== 'string' || !url.trim()) {
      return { ok: false, error: 'Invalid URL.' }
    }
    const u = url.trim()
    if (!u.startsWith('https://') && !u.startsWith('http://')) {
      return { ok: false, error: 'Only http(s) URLs are allowed.' }
    }
    try {
      await shell.openExternal(u)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message || 'Failed to open URL.' }
    }
  })

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

    const cursorResult = await tryOpenFolderWithEditorCli('cursor', p)
    if (cursorResult.ok) {
      return { ok: true }
    }

    const codeResult = await tryOpenFolderWithEditorCli('code', p)
    if (codeResult.ok) {
      return { ok: true }
    }

    return { ok: false, error: NEITHER_EDITOR_CLI_MSG }
  })
}
