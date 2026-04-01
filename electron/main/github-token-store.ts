import { safeStorage } from 'electron'
import Store from 'electron-store'

type Schema = {
  /** Base64 ciphertext or legacy plain utf8 (weak fallback). */
  enc: string | null
}

const legacyStore = new Store<Schema>({
  name: '10x-github',
  defaults: { enc: null },
})

export function saveGithubToken(token: string) {
  if (safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(token)
    legacyStore.set('enc', enc.toString('base64'))
    return
  }
  legacyStore.set('enc', Buffer.from(token, 'utf8').toString('base64'))
}

export function loadGithubToken(): string | null {
  const b64 = legacyStore.get('enc')
  if (!b64 || typeof b64 !== 'string') return null
  const buf = Buffer.from(b64, 'base64')
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buf)
    } catch {
      try {
        return buf.toString('utf8')
      } catch {
        return null
      }
    }
  }
  return buf.toString('utf8')
}

export function clearGithubToken() {
  legacyStore.delete('enc')
}
