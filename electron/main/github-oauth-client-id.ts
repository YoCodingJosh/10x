import { BUNDLED_GITHUB_OAUTH_CLIENT_ID } from './github-bundled-oauth-id'

/**
 * OAuth client id resolution (device flow — public id, not a secret).
 *
 * - `GITHUB_OAUTH_CLIENT_ID`: optional override; dev `.env` at repo root is loaded via
 *   `loadEnvFromAppRoot` before IPC runs.
 * - `BUNDLED_GITHUB_OAUTH_CLIENT_ID`: ship this for packaged apps (no user `.env`).
 *
 * Note: Vite `define` is not used here — nested Electron main builds do not reliably
 * replace globals, which caused `ReferenceError: __MAIN_GITHUB_OAUTH_CLIENT_ID__ is not defined`.
 */
export function getGithubOAuthClientId(): string {
  const fromEnv = process.env.GITHUB_OAUTH_CLIENT_ID?.trim() ?? ''
  return fromEnv || BUNDLED_GITHUB_OAUTH_CLIENT_ID.trim()
}
