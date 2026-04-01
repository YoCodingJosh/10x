import { execFile } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import fixPath from 'fix-path'
import type { IpcMainInvokeEvent } from 'electron'
import { ipcMain, shell } from 'electron'

const execFileAsync = promisify(execFile)

const WORKTREES_ROOT_SEGMENT = '10x-worktrees'

function gitEnv(): NodeJS.ProcessEnv {
  fixPath()
  return {
    ...process.env,
    HOME: process.env.HOME || os.homedir(),
  }
}

async function runGit(
  cwd: string,
  args: string[],
): Promise<{ ok: true; stdout: string; stderr: string } | { ok: false; error: string }> {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      env: gitEnv(),
    })
    return { ok: true, stdout: stdout.trimEnd(), stderr: stderr.trimEnd() }
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string; stdout?: string }
    const msg =
      err.stderr?.trim() ||
      err.stdout?.trim() ||
      err.message ||
      'Git command failed'
    return { ok: false, error: msg }
  }
}

export type GitClassifyResult =
  | { isRepo: false }
  | { isRepo: true; toplevel: string; commonDir: string }

/**
 * Turn `git remote get-url` output into an https URL for opening in a browser.
 * Handles https, git@host:path, ssh://, and git:// remotes.
 */
function gitRemoteUrlToHttpsUrl(remote: string): string | null {
  const s = remote.trim()
  if (!s) return null

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
      const path = u.pathname.replace(/\.git$/i, '') || '/'
      return path === '/' ? u.origin : `${u.origin}${path}`
    } catch {
      return null
    }
  }

  const scp = /^git@([^:]+):(.+)$/i.exec(s)
  if (scp) {
    let host = scp[1]!
    const pathPart = scp[2]!.replace(/\.git$/i, '')
    if (host === 'ssh.github.com') host = 'github.com'
    if (host === 'ssh.gitlab.com') host = 'gitlab.com'
    return `https://${host}/${pathPart}`
  }

  try {
    const normalized = s.startsWith('git://') ? `https://${s.slice('git://'.length)}` : s
    if (!normalized.startsWith('ssh://')) return null
    const u = new URL(normalized)
    let host = u.hostname
    if (host === 'ssh.github.com') host = 'github.com'
    if (host === 'ssh.gitlab.com') host = 'gitlab.com'
    const path = u.pathname.replace(/^\//, '').replace(/\.git$/i, '')
    if (!host || !path) return null
    return `https://${host}/${path}`
  } catch {
    return null
  }
}

export type OpenGitOriginResult = { ok: true } | { ok: false; error: string }

export async function openGitOriginInBrowser(cwd: string): Promise<OpenGitOriginResult> {
  const trimmed = cwd.trim()
  if (!trimmed) {
    return { ok: false, error: 'Invalid path.' }
  }
  if (!existsSync(trimmed)) {
    return { ok: false, error: 'Path does not exist.' }
  }
  const classified = await gitClassify(trimmed)
  if (!classified.isRepo) {
    return { ok: false, error: 'Not a git repository.' }
  }
  const toplevel = classified.toplevel
  const remote = await runGit(toplevel, ['remote', 'get-url', 'origin'])
  if (!remote.ok || !remote.stdout) {
    return { ok: false, error: 'No remote named origin.' }
  }
  const webUrl = gitRemoteUrlToHttpsUrl(remote.stdout)
  if (!webUrl) {
    return { ok: false, error: 'Could not turn this remote into a web URL.' }
  }
  try {
    const u = new URL(webUrl)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, error: 'Unsupported remote URL.' }
    }
  } catch {
    return { ok: false, error: 'Invalid remote URL.' }
  }
  try {
    await shell.openExternal(webUrl)
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Failed to open browser.' }
  }
}

export async function gitClassify(cwd: string): Promise<GitClassifyResult> {
  const inside = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
  if (!inside.ok || inside.stdout !== 'true') {
    return { isRepo: false }
  }
  const top = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (!top.ok || !top.stdout) {
    return { isRepo: false }
  }
  const common = await runGit(cwd, ['rev-parse', '--git-common-dir'])
  if (!common.ok || !common.stdout) {
    return { isRepo: false }
  }
  const commonDir = path.isAbsolute(common.stdout)
    ? common.stdout
    : path.resolve(top.stdout, common.stdout)
  return { isRepo: true, toplevel: top.stdout, commonDir }
}

function slugifySegment(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s.slice(0, 64) || 'workspace'
}

function worktreesRootDir(): string {
  return path.join(os.homedir(), WORKTREES_ROOT_SEGMENT)
}

function isUnderMuxWorktreesDir(absPath: string): boolean {
  const root = path.normalize(worktreesRootDir())
  const p = path.normalize(absPath)
  const prefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`
  return p === root || p.startsWith(prefix)
}

export type RemoveMuxWorktreeResult = { ok: true } | { ok: false; error: string }

/**
 * Removes a 10x-managed linked worktree (~/10x-worktrees/...) from Git and deletes the directory.
 */
export async function removeMuxWorktree(worktreePath: string): Promise<RemoveMuxWorktreeResult> {
  const normalized = path.normalize(worktreePath.trim())
  if (!normalized) {
    return { ok: false, error: 'Invalid path.' }
  }
  if (!isUnderMuxWorktreesDir(normalized)) {
    return {
      ok: false,
      error: 'Only worktrees under ~/10x-worktrees can be removed this way.',
    }
  }

  if (!existsSync(normalized)) {
    return { ok: true }
  }

  const classified = await gitClassify(normalized)
  if (!classified.isRepo) {
    return {
      ok: false,
      error: 'This folder is not a Git worktree anymore. Remove it manually if needed.',
    }
  }

  const cwdForGit = classified.toplevel
  let r = await runGit(cwdForGit, [
    'worktree',
    'remove',
    '--force',
    '--delete-branch',
    normalized,
  ])
  if (!r.ok) {
    r = await runGit(cwdForGit, ['worktree', 'remove', '--force', normalized])
  }

  if (!r.ok) {
    return { ok: false, error: r.error }
  }
  return { ok: true }
}

export type MuxRecoverableWorktree = { path: string; label: string }

function parseWorktreeListPorcelain(output: string): { path: string; branch?: string }[] {
  const text = output.trim()
  if (!text) return []
  const blocks = text.split(/\n\n+/)
  const out: { path: string; branch?: string }[] = []
  for (const block of blocks) {
    let wtPath: string | undefined
    let branch: string | undefined
    for (const line of block.split('\n')) {
      const t = line.trim()
      if (t.startsWith('worktree ')) {
        wtPath = t.slice('worktree '.length).trim()
      }
      if (t.startsWith('branch ')) {
        const ref = t.slice('branch '.length).trim()
        branch = ref.replace(/^refs\/heads\//, '')
      }
    }
    if (wtPath) {
      out.push({ path: path.normalize(wtPath), branch })
    }
  }
  return out
}

/** Linked worktrees under ~/10x-worktrees for this repo (for session recovery). */
export async function listRecoverableMuxWorktrees(repoCwd: string): Promise<MuxRecoverableWorktree[]> {
  const classified = await gitClassify(repoCwd)
  if (!classified.isRepo) {
    return []
  }

  const root = worktreesRootDir()
  const rootNorm = path.normalize(root)
  const listed = await runGit(classified.toplevel, ['worktree', 'list', '--porcelain'])
  if (!listed.ok) {
    return []
  }

  const entries = parseWorktreeListPorcelain(listed.stdout)
  const seen = new Set<string>()
  const result: MuxRecoverableWorktree[] = []

  for (const { path: wtPath, branch } of entries) {
    const prefix = rootNorm.endsWith(path.sep) ? rootNorm : `${rootNorm}${path.sep}`
    if (!wtPath.startsWith(prefix)) {
      continue
    }
    if (!existsSync(wtPath)) {
      continue
    }
    if (seen.has(wtPath)) continue
    seen.add(wtPath)

    const base = path.basename(wtPath)
    const label = branch?.startsWith('mux/') ? branch.slice('mux/'.length) : base

    result.push({ path: wtPath, label: label || base })
  }

  return result
}

export type CreateWorktreeArgs = {
  /** Git repo working tree (e.g. folder user picked). */
  repoCwd: string
  /** Display / folder name from user (slugified for path + branch). */
  worktreeName: string
}

export type CreateWorktreeResult =
  | { ok: true; worktreePath: string; branch: string }
  | { ok: false; error: string }

export async function gitCreateWorktree(args: CreateWorktreeArgs): Promise<CreateWorktreeResult> {
  const classified = await gitClassify(args.repoCwd)
  if (!classified.isRepo) {
    return { ok: false, error: 'Not a Git repository.' }
  }

  const { toplevel } = classified
  const repoSlug = slugifySegment(path.basename(toplevel))
  const wtSlug = slugifySegment(args.worktreeName)

  const worktreePath = path.join(worktreesRootDir(), repoSlug, wtSlug)

  async function branchExistsLocal(branchName: string): Promise<boolean> {
    const r = await runGit(toplevel, ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`])
    return r.ok
  }

  const branchBase = `mux/${wtSlug}`
  let branch: string | null = null
  for (let n = 0; n < 100; n++) {
    const candidate = n === 0 ? branchBase : `${branchBase}-${n}`
    if (!(await branchExistsLocal(candidate))) {
      branch = candidate
      break
    }
  }
  if (branch == null) {
    return { ok: false, error: 'Could not find a free branch name.' }
  }

  try {
    mkdirSync(path.dirname(worktreePath), { recursive: true })
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }

  const add = await runGit(toplevel, ['worktree', 'add', worktreePath, '-b', branch, 'HEAD'])
  if (!add.ok) {
    return { ok: false, error: add.error }
  }

  return { ok: true, worktreePath, branch }
}

export function registerGitIpc() {
  ipcMain.handle('git:openOriginInBrowser', async (_e: IpcMainInvokeEvent, cwd: string) => {
    if (typeof cwd !== 'string' || !cwd.trim()) {
      return { ok: false, error: 'Invalid path.' } satisfies OpenGitOriginResult
    }
    return openGitOriginInBrowser(cwd.trim())
  })

  ipcMain.handle('git:classify', async (_e: IpcMainInvokeEvent, cwd: string) => {
    if (typeof cwd !== 'string' || !cwd.trim()) {
      return { isRepo: false }
    }
    return gitClassify(cwd)
  })

  ipcMain.handle('git:listRecoverableMuxWorktrees', async (_e: IpcMainInvokeEvent, cwd: string) => {
    if (typeof cwd !== 'string' || !cwd.trim()) {
      return [] as MuxRecoverableWorktree[]
    }
    return listRecoverableMuxWorktrees(cwd.trim())
  })

  ipcMain.handle(
    'git:createWorktree',
    async (_e: IpcMainInvokeEvent, args: CreateWorktreeArgs) => {
      if (
        typeof args?.repoCwd !== 'string' ||
        typeof args?.worktreeName !== 'string' ||
        !args.repoCwd.trim() ||
        !args.worktreeName.trim()
      ) {
        return { ok: false, error: 'Invalid arguments.' }
      }
      return gitCreateWorktree({
        repoCwd: args.repoCwd,
        worktreeName: args.worktreeName.trim(),
      })
    },
  )

  ipcMain.handle(
    'git:removeMuxWorktree',
    async (_e: IpcMainInvokeEvent, worktreePath: string) => {
      if (typeof worktreePath !== 'string' || !worktreePath.trim()) {
        return { ok: false, error: 'Invalid path.' }
      }
      return removeMuxWorktree(worktreePath)
    },
  )
}
