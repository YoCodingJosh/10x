import { execFile } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'

import fixPath from 'fix-path'
import type { IpcMainInvokeEvent } from 'electron'
import { ipcMain } from 'electron'

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
  ipcMain.handle('git:classify', async (_e: IpcMainInvokeEvent, cwd: string) => {
    if (typeof cwd !== 'string' || !cwd.trim()) {
      return { isRepo: false }
    }
    return gitClassify(cwd)
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
}
