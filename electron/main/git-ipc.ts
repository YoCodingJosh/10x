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

/** Branch names for agent worktrees: `10x/<slug>`. */
const WORKTREE_BRANCH_PREFIX = '10x/'

function recoverableWorktreeLabelFromBranch(branch: string | undefined, pathBasename: string): string {
  if (branch?.startsWith(WORKTREE_BRANCH_PREFIX)) {
    return branch.slice(WORKTREE_BRANCH_PREFIX.length) || pathBasename
  }
  return pathBasename
}

/** `fix-path` runs a sync login shell to rebuild PATH — do that once per process, not per `git` spawn. */
let didFixPathForGit = false

function gitEnv(): NodeJS.ProcessEnv {
  if (!didFixPathForGit) {
    fixPath()
    didFixPathForGit = true
  }
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
export function gitRemoteUrlToHttpsUrl(remote: string): string | null {
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

export type GitSimpleResult = { ok: true } | { ok: false; error: string }

function validateExistingDir(cwd: string): { ok: true; path: string } | { ok: false; error: string } {
  const p = cwd.trim()
  if (!p) return { ok: false, error: 'Invalid path.' }
  if (!existsSync(p)) return { ok: false, error: 'Path does not exist.' }
  return { ok: true, path: p }
}

async function resolveRepoRoot(
  rawPath: string,
): Promise<{ ok: true; root: string } | { ok: false; error: string }> {
  const v = validateExistingDir(rawPath)
  if (!v.ok) return v
  const classified = await gitClassify(v.path)
  if (!classified.isRepo) return { ok: false, error: 'Not a Git repository.' }
  return { ok: true, root: classified.toplevel }
}

export async function gitInit(rawPath: string): Promise<GitSimpleResult> {
  const v = validateExistingDir(rawPath)
  if (!v.ok) return v
  const classified = await gitClassify(v.path)
  if (classified.isRepo) {
    return { ok: false, error: 'Already a Git repository.' }
  }
  const r = await runGit(v.path, ['init'])
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true }
}

export async function gitAddAll(rawPath: string): Promise<GitSimpleResult> {
  const resolved = await resolveRepoRoot(rawPath)
  if (!resolved.ok) return resolved
  const r = await runGit(resolved.root, ['add', '-A'])
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true }
}

export async function gitCommit(rawPath: string, message: string): Promise<GitSimpleResult> {
  const msg = message.trim()
  if (!msg) return { ok: false, error: 'Commit message cannot be empty.' }
  const resolved = await resolveRepoRoot(rawPath)
  if (!resolved.ok) return resolved
  const r = await runGit(resolved.root, ['commit', '-m', msg])
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true }
}

/**
 * Pushes the current branch. Uses `git push` when an upstream exists, otherwise
 * `git push -u origin HEAD` (first push for a new branch / worktree branch).
 */
export async function gitPush(rawPath: string): Promise<GitSimpleResult> {
  const resolved = await resolveRepoRoot(rawPath)
  if (!resolved.ok) return resolved
  const root = resolved.root
  if (!(await gitRepoHasOriginRemote(root))) {
    return {
      ok: false,
      error: 'No remote named origin. Add a remote before pushing.',
    }
  }
  const upstream = await runGit(root, ['rev-parse', '--abbrev-ref', '@{u}'])
  const push = await runGit(
    root,
    upstream.ok && upstream.stdout.trim().length > 0 ? ['push'] : ['push', '-u', 'origin', 'HEAD'],
  )
  if (!push.ok) return { ok: false, error: push.error }
  return { ok: true }
}

/**
 * Pulls from upstream when configured (same requirement as a plain `git pull`).
 */
export async function gitPull(rawPath: string): Promise<GitSimpleResult> {
  const resolved = await resolveRepoRoot(rawPath)
  if (!resolved.ok) return resolved
  const root = resolved.root
  const upstream = await runGit(root, ['rev-parse', '--abbrev-ref', '@{u}'])
  if (!upstream.ok || !upstream.stdout.trim()) {
    return {
      ok: false,
      error: 'No upstream branch configured. Push or set upstream before pulling.',
    }
  }
  const pull = await runGit(root, ['pull', '--no-edit'])
  if (!pull.ok) return { ok: false, error: pull.error }
  return { ok: true }
}

/**
 * Updates remote-tracking refs for `origin` without merging (`git fetch --prune origin`).
 */
export async function gitFetch(rawPath: string): Promise<GitSimpleResult> {
  const resolved = await resolveRepoRoot(rawPath)
  if (!resolved.ok) return resolved
  const root = resolved.root
  if (!(await gitRepoHasOriginRemote(root))) {
    return {
      ok: false,
      error: 'No remote named origin. Add a remote before fetching.',
    }
  }
  const fetch = await runGit(root, ['fetch', '--prune', 'origin'])
  if (!fetch.ok) return { ok: false, error: fetch.error }
  return { ok: true }
}

export type GitWorkingTreeSummary = {
  branchLabel: string
  detached: boolean
  upstreamShort: string | null
  ahead: number
  behind: number
  upstreamGone: boolean
  /** Whether `git remote get-url origin` succeeds (same signal as `gitRemoteOriginStatus`). */
  hasOrigin: boolean
  /** True when this checkout lives under ~/10x-worktrees (Mux agent worktree). */
  isMuxWorktree: boolean
  /**
   * Current branch matches `origin`'s default branch (`refs/remotes/origin/HEAD`), or a
   * common default name if that ref is missing. Create PR is not offered on this branch.
   */
  isOriginDefaultBranch: boolean
  stagedCount: number
  unstagedCount: number
  untrackedCount: number
  conflictCount: number
}

export type GitWorkingTreeSummaryResult = { isRepo: false } | { isRepo: true; summary: GitWorkingTreeSummary }

async function gitOriginDefaultBranchShort(repoRoot: string): Promise<string | null> {
  const r = await runGit(repoRoot, ['symbolic-ref', '-q', 'refs/remotes/origin/HEAD'])
  if (!r.ok || !r.stdout.trim()) return null
  const ref = r.stdout.trim()
  const m = /^refs\/remotes\/origin\/(.+)$/.exec(ref)
  return m?.[1] ?? null
}

function parseGitStatusBranchLine(line: string): Omit<
  GitWorkingTreeSummary,
  | 'hasOrigin'
  | 'isMuxWorktree'
  | 'isOriginDefaultBranch'
  | 'stagedCount'
  | 'unstagedCount'
  | 'untrackedCount'
  | 'conflictCount'
> {
  const emptyUpstream = {
    branchLabel: '?',
    detached: false,
    upstreamShort: null as string | null,
    ahead: 0,
    behind: 0,
    upstreamGone: false,
  }
  if (!line.startsWith('## ')) return emptyUpstream

  const rest = line.slice(3).trim()
  if (rest.startsWith('HEAD (no branch')) {
    const at = /at ([\w.-]+)/.exec(rest)
    return {
      branchLabel: at ? `Detached @ ${at[1]}` : 'Detached HEAD',
      detached: true,
      upstreamShort: null,
      ahead: 0,
      behind: 0,
      upstreamGone: false,
    }
  }

  const parseBracket = (bracket: string) => {
    let ahead = 0
    let behind = 0
    let upstreamGone = false
    if (bracket.includes('gone')) upstreamGone = true
    const am = /ahead (\d+)/.exec(bracket)
    const bm = /behind (\d+)/.exec(bracket)
    if (am) ahead = parseInt(am[1]!, 10)
    if (bm) behind = parseInt(bm[1]!, 10)
    return { ahead, behind, upstreamGone }
  }

  const splitIdx = rest.indexOf('...')
  if (splitIdx === -1) {
    const m = /^(.*?)(?:\s+\[([^\]]+)\])?\s*$/.exec(rest)
    const branchPart = (m?.[1] ?? rest).trim()
    const bracket = m?.[2]
    let ahead = 0
    let behind = 0
    let upstreamGone = false
    if (bracket) {
      const p = parseBracket(bracket)
      ahead = p.ahead
      behind = p.behind
      upstreamGone = p.upstreamGone
    }
    return {
      branchLabel: branchPart || '?',
      detached: false,
      upstreamShort: null,
      ahead,
      behind,
      upstreamGone,
    }
  }

  const branchLabel = rest.slice(0, splitIdx).trim()
  let after = rest.slice(splitIdx + 3).trim()
  let bracket: string | undefined
  const openB = after.indexOf(' [')
  if (openB !== -1) {
    const close = after.lastIndexOf(']')
    if (close > openB) {
      bracket = after.slice(openB + 2, close)
      after = after.slice(0, openB).trim()
    }
  }
  const upstreamShort = after || null
  let ahead = 0
  let behind = 0
  let upstreamGone = false
  if (bracket) {
    const p = parseBracket(bracket)
    ahead = p.ahead
    behind = p.behind
    upstreamGone = p.upstreamGone
  }
  return {
    branchLabel: branchLabel || '?',
    detached: false,
    upstreamShort,
    ahead,
    behind,
    upstreamGone,
  }
}

function parseGitStatusFileLines(fileLines: string[]): Pick<
  GitWorkingTreeSummary,
  'stagedCount' | 'unstagedCount' | 'untrackedCount' | 'conflictCount'
> {
  let stagedCount = 0
  let unstagedCount = 0
  let untrackedCount = 0
  let conflictCount = 0

  for (const line of fileLines) {
    const t = line.trimEnd()
    if (t.length < 2) continue
    const xy = t.slice(0, 2)
    const x = xy[0]!
    const y = xy[1]!

    if (xy === '!!') continue

    if (xy === '??') {
      untrackedCount += 1
      continue
    }

    const unmerged =
      x === 'U' ||
      y === 'U' ||
      (x === 'A' && y === 'A') ||
      (x === 'D' && y === 'D')
    if (unmerged) {
      conflictCount += 1
      continue
    }

    if (x !== ' ' && x !== '?') stagedCount += 1
    if (y !== ' ' && y !== '?') unstagedCount += 1
  }

  return { stagedCount, unstagedCount, untrackedCount, conflictCount }
}

/**
 * Whether `origin` exists: `get-url` is enough when Git is healthy; fall back to `git remote`
 * (some setups report get-url failure while the remote is still configured).
 */
async function gitRepoHasOriginRemote(repoRoot: string): Promise<boolean> {
  const url = await runGit(repoRoot, ['remote', 'get-url', 'origin'])
  if (url.ok && url.stdout?.trim()) return true
  const rem = await runGit(repoRoot, ['remote'])
  if (!rem.ok || !rem.stdout?.trim()) return false
  return rem.stdout
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .includes('origin')
}

export async function gitWorkingTreeSummary(rawPath: string): Promise<GitWorkingTreeSummaryResult> {
  const classified = await gitClassify(rawPath.trim())
  if (!classified.isRepo) {
    return { isRepo: false }
  }
  const root = classified.toplevel
  const st = await runGit(root, ['status', '-sb'])
  if (!st.ok) {
    return { isRepo: false }
  }

  const lines = st.stdout.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0)
  let branchLine = '##'
  const fileLines: string[] = []
  for (const line of lines) {
    if (line.startsWith('## ')) {
      branchLine = line
    } else {
      fileLines.push(line)
    }
  }

  const meta = parseGitStatusBranchLine(branchLine)
  const counts = parseGitStatusFileLines(fileLines)
  const hasOrigin = await gitRepoHasOriginRemote(root)
  const isMuxWorktree = isUnderMuxWorktreesDir(root)

  let isOriginDefaultBranch = false
  if (hasOrigin && !meta.detached) {
    const originDefault = await gitOriginDefaultBranchShort(root)
    if (originDefault != null) {
      isOriginDefaultBranch = meta.branchLabel === originDefault
    } else if (['main', 'master', 'trunk'].includes(meta.branchLabel)) {
      isOriginDefaultBranch = true
    }
  }

  return {
    isRepo: true,
    summary: {
      ...meta,
      ...counts,
      hasOrigin,
      isMuxWorktree,
      isOriginDefaultBranch,
    },
  }
}

export async function gitAddRemote(
  rawPath: string,
  remoteName: string,
  remoteUrl: string,
): Promise<GitSimpleResult> {
  const name = remoteName.trim()
  const url = remoteUrl.trim()
  if (!name || !url) {
    return { ok: false, error: 'Remote name and URL are required.' }
  }
  const resolved = await resolveRepoRoot(rawPath)
  if (!resolved.ok) return resolved
  const existing = await runGit(resolved.root, ['remote', 'get-url', name])
  if (existing.ok && existing.stdout) {
    return {
      ok: false,
      error: `Remote "${name}" already exists. Remove it first or pick another name.`,
    }
  }
  const r = await runGit(resolved.root, ['remote', 'add', name, url])
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true }
}

export type GitRemoteOriginStatus =
  | { isRepo: false }
  | { isRepo: true; hasOrigin: boolean }

/**
 * Whether `cwd` is a Git repo and has a remote named `origin`.
 */
export async function gitRemoteOriginStatus(rawPath: string): Promise<GitRemoteOriginStatus> {
  const classified = await gitClassify(rawPath.trim())
  if (!classified.isRepo) {
    return { isRepo: false }
  }
  const hasOrigin = await gitRepoHasOriginRemote(classified.toplevel)
  return { isRepo: true, hasOrigin }
}

export type GitGithubCompareBasicsResult =
  | { kind: 'na' }
  | { kind: 'err'; error: string }
  | { kind: 'ok'; owner: string; repo: string; branch: string }

function parseGithubOwnerRepoFromWebUrl(webUrl: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(webUrl)
    if (u.hostname.toLowerCase() !== 'github.com') return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts.length < 2) return null
    return { owner: parts[0]!, repo: parts[1]!.replace(/\.git$/i, '') }
  } catch {
    return null
  }
}

/**
 * Owner/repo/branch for opening GitHub compare / PR flow. Only for Mux worktrees + github.com origin.
 */
export async function gitGithubCompareBasics(rawPath: string): Promise<GitGithubCompareBasicsResult> {
  const classified = await gitClassify(rawPath.trim())
  if (!classified.isRepo) return { kind: 'na' }
  if (!isUnderMuxWorktreesDir(classified.toplevel)) return { kind: 'na' }

  const br = await runGit(classified.toplevel, ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (!br.ok || !br.stdout?.trim()) return { kind: 'err', error: 'Could not read current branch.' }
  const branch = br.stdout.trim()
  if (branch === 'HEAD') return { kind: 'err', error: 'Detached HEAD.' }

  const rem = await runGit(classified.toplevel, ['remote', 'get-url', 'origin'])
  if (!rem.ok || !rem.stdout?.trim()) return { kind: 'err', error: 'No origin remote.' }

  const httpsUrl = gitRemoteUrlToHttpsUrl(rem.stdout)
  if (!httpsUrl) return { kind: 'err', error: 'Could not parse origin URL.' }
  const parsed = parseGithubOwnerRepoFromWebUrl(httpsUrl)
  if (!parsed) return { kind: 'err', error: 'Origin is not a github.com repository.' }
  return { kind: 'ok', owner: parsed.owner, repo: parsed.repo, branch }
}

export async function gitClassify(cwd: string): Promise<GitClassifyResult> {
  /** One process instead of three sequential `rev-parse` calls (saves ~2 spawns per summary). */
  const r = await runGit(cwd, [
    'rev-parse',
    '--is-inside-work-tree',
    '--show-toplevel',
    '--git-common-dir',
  ])
  if (!r.ok || !r.stdout) {
    return { isRepo: false }
  }
  const lines = r.stdout.split('\n').filter((l) => l.length > 0)
  if (lines.length < 3) {
    return { isRepo: false }
  }
  const inside = lines[0]!.trim()
  const topRaw = lines[1]!.trim()
  const commonRaw = lines[2]!.trim()
  if (inside !== 'true' || !topRaw || !commonRaw) {
    return { isRepo: false }
  }
  const commonDir = path.isAbsolute(commonRaw)
    ? commonRaw
    : path.resolve(topRaw, commonRaw)
  return { isRepo: true, toplevel: topRaw, commonDir }
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

/**
 * `git worktree remove` must be run with the **main** checkout as cwd, not a linked worktree.
 * Walks up from `commonDir` (…/.git or …/.git/worktrees/…) to the primary working tree.
 */
function gitMainWorkingTreeRoot(classified: { toplevel: string; commonDir: string }): string {
  const common = path.normalize(classified.commonDir)
  let p = common
  for (let i = 0; i < 32; i++) {
    if (path.basename(p) === '.git') {
      return path.dirname(p)
    }
    const parent = path.dirname(p)
    if (parent === p) break
    p = parent
  }
  return classified.toplevel
}

export type RemoveMuxWorktreeResult = { ok: true } | { ok: false; error: string }

/**
 * After a merged PR: best-effort `git push origin --delete <branch>`, then remove the Mux worktree.
 */
export async function gitCleanupMergedMuxWorktree(rawPath: string): Promise<RemoveMuxWorktreeResult> {
  const v = validateExistingDir(rawPath)
  if (!v.ok) return v
  const classified = await gitClassify(v.path)
  if (!classified.isRepo) {
    return { ok: false, error: 'Not a Git repository.' }
  }
  const top = classified.toplevel
  if (!isUnderMuxWorktreesDir(top)) {
    return {
      ok: false,
      error: 'Only agent worktrees under ~/10x-worktrees can be cleaned up this way.',
    }
  }

  const br = await runGit(top, ['rev-parse', '--abbrev-ref', 'HEAD'])
  if (!br.ok || !br.stdout?.trim()) {
    return { ok: false, error: 'Could not read current branch.' }
  }
  const branch = br.stdout.trim()
  if (branch === 'HEAD') {
    return { ok: false, error: 'Detached HEAD.' }
  }

  const mainRoot = gitMainWorkingTreeRoot(classified)

  await runGit(top, ['push', 'origin', '--delete', branch])

  const removed = await removeMuxWorktree(top)
  if (!removed.ok) return removed

  await runGit(mainRoot, ['fetch', '--prune', 'origin'])
  return { ok: true }
}

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

  const mainRoot = gitMainWorkingTreeRoot(classified)
  let r = await runGit(mainRoot, [
    'worktree',
    'remove',
    '--force',
    '--delete-branch',
    normalized,
  ])
  if (!r.ok) {
    r = await runGit(mainRoot, ['worktree', 'remove', '--force', normalized])
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
    const label = recoverableWorktreeLabelFromBranch(branch, base)

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

  const branchBase = `${WORKTREE_BRANCH_PREFIX}${wtSlug}`
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

export type GitDiffMode = 'unstaged' | 'staged' | 'all'

export async function gitDiff(
  cwd: string,
  mode: GitDiffMode,
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  const trimmed = cwd.trim()
  if (!trimmed) {
    return { ok: false, error: 'Invalid path.' }
  }
  const classified = await gitClassify(trimmed)
  if (!classified.isRepo) {
    return { ok: false, error: 'Not a git repository.' }
  }
  const args =
    mode === 'unstaged'
      ? ['diff', '--no-ext-diff', '--no-color']
      : mode === 'staged'
        ? ['diff', '--cached', '--no-ext-diff', '--no-color']
        : ['diff', 'HEAD', '--no-ext-diff', '--no-color']
  const r = await runGit(trimmed, args)
  if (!r.ok) {
    return { ok: false, error: r.error }
  }
  return { ok: true, text: r.stdout }
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

  ipcMain.handle('git:remoteOriginStatus', async (_e: IpcMainInvokeEvent, cwd: string) => {
    if (typeof cwd !== 'string' || !cwd.trim()) {
      return { isRepo: false }
    }
    return gitRemoteOriginStatus(cwd.trim())
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

  ipcMain.handle('git:cleanupMergedMuxWorktree', async (_e: IpcMainInvokeEvent, rawPath: string) => {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return { ok: false, error: 'Invalid path.' }
    }
    return gitCleanupMergedMuxWorktree(rawPath.trim())
  })

  ipcMain.handle('git:init', async (_e: IpcMainInvokeEvent, rawPath: string) => {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return { ok: false, error: 'Invalid path.' } satisfies GitSimpleResult
    }
    return gitInit(rawPath.trim())
  })

  ipcMain.handle('git:addAll', async (_e: IpcMainInvokeEvent, rawPath: string) => {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return { ok: false, error: 'Invalid path.' } satisfies GitSimpleResult
    }
    return gitAddAll(rawPath.trim())
  })

  ipcMain.handle(
    'git:commit',
    async (_e: IpcMainInvokeEvent, args: { cwd: string; message: string }) => {
      if (typeof args?.cwd !== 'string' || !args.cwd.trim()) {
        return { ok: false, error: 'Invalid path.' } satisfies GitSimpleResult
      }
      if (typeof args?.message !== 'string') {
        return { ok: false, error: 'Invalid commit message.' } satisfies GitSimpleResult
      }
      return gitCommit(args.cwd.trim(), args.message)
    },
  )

  ipcMain.handle('git:push', async (_e: IpcMainInvokeEvent, rawPath: string) => {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return { ok: false, error: 'Invalid path.' } satisfies GitSimpleResult
    }
    return gitPush(rawPath.trim())
  })

  ipcMain.handle('git:pull', async (_e: IpcMainInvokeEvent, rawPath: string) => {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return { ok: false, error: 'Invalid path.' } satisfies GitSimpleResult
    }
    return gitPull(rawPath.trim())
  })

  ipcMain.handle('git:fetch', async (_e: IpcMainInvokeEvent, rawPath: string) => {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return { ok: false, error: 'Invalid path.' } satisfies GitSimpleResult
    }
    return gitFetch(rawPath.trim())
  })

  ipcMain.handle('git:workingTreeSummary', async (_e: IpcMainInvokeEvent, rawPath: string) => {
    if (typeof rawPath !== 'string' || !rawPath.trim()) {
      return { isRepo: false } satisfies GitWorkingTreeSummaryResult
    }
    return gitWorkingTreeSummary(rawPath.trim())
  })

  ipcMain.handle(
    'git:addRemote',
    async (
      _e: IpcMainInvokeEvent,
      args: { cwd: string; remoteName: string; url: string },
    ) => {
      if (typeof args?.cwd !== 'string' || !args.cwd.trim()) {
        return { ok: false, error: 'Invalid path.' } satisfies GitSimpleResult
      }
      if (typeof args?.remoteName !== 'string' || typeof args?.url !== 'string') {
        return { ok: false, error: 'Invalid remote name or URL.' } satisfies GitSimpleResult
      }
      return gitAddRemote(args.cwd.trim(), args.remoteName, args.url)
    },
  )

  ipcMain.handle(
    'git:diff',
    async (
      _e: IpcMainInvokeEvent,
      args: { cwd: string; mode: GitDiffMode },
    ) => {
      if (typeof args?.cwd !== 'string' || !args.cwd.trim()) {
        return { ok: false, error: 'Invalid path.' }
      }
      const mode: GitDiffMode =
        args.mode === 'staged' || args.mode === 'unstaged' ? args.mode : 'all'
      return gitDiff(args.cwd.trim(), mode)
    },
  )
}
