import { ipcMain, shell } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'

import { gitAddRemote, gitGithubCompareBasics } from './git-ipc'
import { getGithubOAuthClientId } from './github-oauth-client-id'
import {
  clearGithubToken,
  loadGithubToken,
  saveGithubToken,
} from './github-token-store'

const DEVICE_CODE_URL = 'https://github.com/login/device/code'
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token'

function getClientId(): string {
  return getGithubOAuthClientId()
}

async function githubPostForm(url: string, body: URLSearchParams): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body,
  })
  const text = await res.text()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    return { error: 'parse_error', error_description: text.slice(0, 300) }
  }
}

export type DeviceStartResult =
  | {
      ok: true
      userCode: string
      verificationUri: string
      verificationUriComplete: string
      deviceCode: string
      interval: number
      expiresIn: number
    }
  | { ok: false; error: string }

export async function startGithubDeviceLogin(): Promise<DeviceStartResult> {
  const clientId = getClientId()
  if (!clientId) {
    return {
      ok: false,
      error:
        'GitHub sign-in is not configured for this build. The app publisher must register a GitHub OAuth app and ship a Client ID (bundled in the app or supplied at build time).',
    }
  }
  const body = new URLSearchParams({
    client_id: clientId,
    scope: 'repo read:user',
  })
  const data = await githubPostForm(DEVICE_CODE_URL, body)
  if (data.error != null) {
    const desc = data.error_description != null ? String(data.error_description) : String(data.error)
    return { ok: false, error: desc }
  }
  const deviceCode = data.device_code
  if (typeof deviceCode !== 'string' || !deviceCode) {
    return { ok: false, error: 'Unexpected response from GitHub (no device_code).' }
  }
  return {
    ok: true,
    userCode: String(data.user_code ?? ''),
    verificationUri: String(data.verification_uri ?? 'https://github.com/login/device'),
    verificationUriComplete: String(
      data.verification_uri_complete ?? data.verification_uri ?? 'https://github.com/login/device',
    ),
    deviceCode,
    interval: Math.max(5, Number(data.interval) || 5),
    expiresIn: Math.max(60, Number(data.expires_in) || 900),
  }
}

export type PollDeviceResult =
  | { status: 'authorized'; login: string }
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'error'; error: string }

export async function pollGithubDeviceLogin(deviceCode: string): Promise<PollDeviceResult> {
  const clientId = getClientId()
  if (!clientId) return { status: 'error', error: 'Missing OAuth client id.' }
  const body = new URLSearchParams({
    client_id: clientId,
    device_code: deviceCode,
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
  })
  const data = await githubPostForm(ACCESS_TOKEN_URL, body)

  if (typeof data.access_token === 'string' && data.access_token.length > 0) {
    saveGithubToken(data.access_token)
    const user = await fetchGithubUser(data.access_token)
    if (!user) {
      clearGithubToken()
      return { status: 'error', error: 'Could not read your GitHub profile.' }
    }
    return { status: 'authorized', login: user.login }
  }

  const err = String(data.error ?? '')
  if (err === 'authorization_pending') return { status: 'pending' }
  if (err === 'slow_down') return { status: 'slow_down' }
  if (err === 'expired_token')
    return { status: 'error', error: 'The device login expired. Start again.' }
  if (err === 'access_denied') return { status: 'error', error: 'GitHub sign-in was cancelled.' }

  const desc = data.error_description != null ? String(data.error_description) : err || 'Unknown error'
  return { status: 'error', error: desc }
}

async function githubApiGetJson<T>(
  pathname: string,
  token: string | null,
): Promise<{ ok: true; data: T } | { ok: false; status: number }> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(`https://api.github.com${pathname}`, { headers })
  if (!res.ok) return { ok: false, status: res.status }
  return { ok: true, data: (await res.json()) as T }
}

export type GithubCreatePrContext =
  | { applicable: false }
  | { applicable: true; hasOpenPr: boolean; hasMergedPr: boolean; compareUrl: string }

export async function githubGetCreatePrContext(cwd: string): Promise<GithubCreatePrContext> {
  const b = await gitGithubCompareBasics(cwd.trim())
  if (b.kind !== 'ok') {
    return { applicable: false }
  }

  const token = loadGithubToken()
  const { owner, repo, branch } = b

  let defaultBranch = 'main'
  const repoRes = await githubApiGetJson<{ default_branch?: string }>(`/repos/${owner}/${repo}`, token)
  if (repoRes.ok && typeof repoRes.data.default_branch === 'string' && repoRes.data.default_branch) {
    defaultBranch = repoRes.data.default_branch
  }

  if (branch === defaultBranch) {
    return { applicable: false }
  }

  const compareUrl = `https://github.com/${owner}/${repo}/compare/${encodeURIComponent(defaultBranch)}...${encodeURIComponent(branch)}?expand=1`

  const headQ = encodeURIComponent(`${owner}:${branch}`)

  let hasOpenPr = false
  const pullsOpen = await githubApiGetJson<{ merged_at?: string | null }[]>(
    `/repos/${owner}/${repo}/pulls?state=open&head=${headQ}`,
    token,
  )
  if (pullsOpen.ok && Array.isArray(pullsOpen.data)) {
    hasOpenPr = pullsOpen.data.length > 0
  }

  let hasMergedPr = false
  if (!hasOpenPr) {
    const pullsClosed = await githubApiGetJson<{ merged_at?: string | null }[]>(
      `/repos/${owner}/${repo}/pulls?state=closed&head=${headQ}&per_page=15&sort=updated&direction=desc`,
      token,
    )
    if (pullsClosed.ok && Array.isArray(pullsClosed.data)) {
      hasMergedPr = pullsClosed.data.some((p) => p.merged_at != null && String(p.merged_at).length > 0)
    }
  }

  return { applicable: true, hasOpenPr, hasMergedPr, compareUrl }
}

async function fetchGithubUser(token: string): Promise<{ login: string } | null> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) return null
  const u = (await res.json()) as { login?: string }
  return u.login ? { login: u.login } : null
}

export async function getGithubConnectionStatus(): Promise<
  { connected: false } | { connected: true; login: string }
> {
  const token = loadGithubToken()
  if (!token) return { connected: false }
  const user = await fetchGithubUser(token)
  if (!user) {
    clearGithubToken()
    return { connected: false }
  }
  return { connected: true, login: user.login }
}

type CreateRepoApiOk = {
  ok: true
  clone_url: string
  ssh_url: string
  html_url: string
}

type CreateRepoApiErr = { ok: false; error: string }

async function createGithubRepoOnApi(
  token: string,
  args: { name: string; description?: string; private?: boolean },
): Promise<CreateRepoApiOk | CreateRepoApiErr> {
  const res = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: args.name.trim().replace(/\s+/g, '-'),
      description: args.description?.trim() || undefined,
      private: Boolean(args.private),
      auto_init: false,
    }),
  })
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const msg = raw.message != null ? String(raw.message) : `${res.status} ${res.statusText}`
    return { ok: false, error: String(msg) }
  }
  const d = raw as { clone_url?: string; ssh_url?: string; html_url?: string }
  return {
    ok: true,
    clone_url: d.clone_url ?? '',
    ssh_url: d.ssh_url ?? '',
    html_url: d.html_url ?? '',
  }
}

export function registerGithubIpc() {
  ipcMain.handle('github:deviceStart', async () => startGithubDeviceLogin())

  ipcMain.handle('github:devicePoll', async (_e: IpcMainInvokeEvent, deviceCode: unknown) => {
    if (typeof deviceCode !== 'string' || !deviceCode.trim()) {
      return { status: 'error' as const, error: 'Invalid device session.' }
    }
    return pollGithubDeviceLogin(deviceCode.trim())
  })

  ipcMain.handle('github:getStatus', async () => getGithubConnectionStatus())

  ipcMain.handle('github:disconnect', async () => {
    clearGithubToken()
    return { ok: true as const }
  })

  ipcMain.handle(
    'github:createRepo',
    async (
      _e: IpcMainInvokeEvent,
      args: { name?: string; description?: string; private?: boolean },
    ) => {
      if (typeof args?.name !== 'string' || !args.name.trim()) {
        return { ok: false as const, error: 'Repository name is required.' }
      }
      const token = loadGithubToken()
      if (!token) {
        return { ok: false as const, error: 'Connect GitHub in Settings first.' }
      }
      return createGithubRepoOnApi(token, {
        name: args.name,
        description: typeof args.description === 'string' ? args.description : undefined,
        private: Boolean(args.private),
      })
    },
  )

  ipcMain.handle(
    'github:createRepoAndLink',
    async (
      _e: IpcMainInvokeEvent,
      payload: {
        cwd?: string
        name?: string
        description?: string
        private?: boolean
      },
    ) => {
      const cwd = payload?.cwd
      const name = payload?.name
      if (typeof cwd !== 'string' || !cwd.trim()) {
        return { ok: false as const, error: 'Invalid path.' }
      }
      if (typeof name !== 'string' || !name.trim()) {
        return { ok: false as const, error: 'Repository name is required.' }
      }
      const token = loadGithubToken()
      if (!token) {
        return { ok: false as const, error: 'Connect GitHub in Settings first.' }
      }
      const created = await createGithubRepoOnApi(token, {
        name,
        description: typeof payload.description === 'string' ? payload.description : undefined,
        private: Boolean(payload.private),
      })
      if (!created.ok) return created

      const url = created.clone_url
      if (!url) {
        return { ok: false as const, error: 'GitHub did not return a repository URL.' }
      }
      const link = await gitAddRemote(cwd.trim(), 'origin', url)
      if (!link.ok) {
        return {
          ok: false as const,
          error: `Created ${created.html_url} but could not add remote \`origin\`: ${link.error}`,
        }
      }
      return {
        ok: true as const,
        html_url: created.html_url,
        clone_url: created.clone_url,
        ssh_url: created.ssh_url,
      }
    },
  )

  ipcMain.handle('github:openNewRepoPage', async () => {
    await shell.openExternal('https://github.com/new')
    return { ok: true as const }
  })

  ipcMain.handle('github:openOAuthAppSettings', async () => {
    await shell.openExternal('https://github.com/settings/developers')
    return { ok: true as const }
  })

  ipcMain.handle('github:openDeviceHelp', async () => {
    await shell.openExternal(
      'https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow',
    )
    return { ok: true as const }
  })

  ipcMain.handle('github:getCreatePrContext', async (_e: IpcMainInvokeEvent, rawCwd: unknown) => {
    if (typeof rawCwd !== 'string' || !rawCwd.trim()) {
      return { applicable: false as const }
    }
    return githubGetCreatePrContext(rawCwd.trim())
  })
}
