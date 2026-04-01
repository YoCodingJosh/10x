import { useCallback, useEffect, useRef, useState } from 'react'

export type GithubDeviceStep =
  | { kind: 'idle' }
  | {
      kind: 'polling'
      userCode: string
      verificationUriComplete: string
      deviceCode: string
    }
  | { kind: 'error'; message: string }

type UseGithubDeviceAuthOptions = {
  /** When false, skip the initial `getStatus` until `refreshGithub()` runs (e.g. publish dialog). */
  fetchOnMount?: boolean
}

export function useGithubDeviceAuth(options: UseGithubDeviceAuthOptions = {}) {
  const fetchOnMount = options.fetchOnMount !== false
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [deviceStep, setDeviceStep] = useState<GithubDeviceStep>({ kind: 'idle' })
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  const refreshGithub = useCallback(async () => {
    setLoadingStatus(true)
    try {
      const s = await window.mux.github.getStatus()
      setGithubLogin(s.connected ? s.login : null)
    } finally {
      setLoadingStatus(false)
    }
  }, [])

  useEffect(() => {
    if (fetchOnMount) void refreshGithub()
  }, [fetchOnMount, refreshGithub])

  useEffect(() => {
    return () => stopPolling()
  }, [stopPolling])

  const startGithubConnect = useCallback(async () => {
    stopPolling()
    setDeviceStep({ kind: 'idle' })
    const start = await window.mux.github.deviceStart()
    if (!start.ok) {
      setDeviceStep({ kind: 'error', message: start.error })
      return
    }
    setDeviceStep({
      kind: 'polling',
      userCode: start.userCode,
      verificationUriComplete: start.verificationUriComplete,
      deviceCode: start.deviceCode,
    })
    window.open(start.verificationUriComplete, '_blank', 'noopener,noreferrer')
    let intervalMs = start.interval * 1000

    const tick = async () => {
      const poll = await window.mux.github.devicePoll(start.deviceCode)
      if (poll.status === 'authorized') {
        stopPolling()
        setDeviceStep({ kind: 'idle' })
        setGithubLogin(poll.login)
        return
      }
      if (poll.status === 'error') {
        stopPolling()
        setDeviceStep({ kind: 'error', message: poll.error })
        return
      }
      if (poll.status === 'slow_down') {
        intervalMs = Math.min(intervalMs + 5000, 60_000)
        stopPolling()
        pollTimerRef.current = setInterval(tick, intervalMs)
      }
    }

    pollTimerRef.current = setInterval(tick, intervalMs)
    void tick()
  }, [stopPolling])

  const cancelDeviceLogin = useCallback(() => {
    stopPolling()
    setDeviceStep({ kind: 'idle' })
  }, [stopPolling])

  const signOutGithub = useCallback(async () => {
    stopPolling()
    setDeviceStep({ kind: 'idle' })
    await window.mux.github.disconnect()
    setGithubLogin(null)
  }, [stopPolling])

  const resetDeviceError = useCallback(() => {
    setDeviceStep({ kind: 'idle' })
  }, [])

  const polling = deviceStep.kind === 'polling'

  return {
    githubLogin,
    loadingStatus,
    deviceStep,
    polling,
    refreshGithub,
    startGithubConnect,
    cancelDeviceLogin,
    signOutGithub,
    stopPolling,
    resetDeviceError,
  }
}

export type GithubDeviceAuth = ReturnType<typeof useGithubDeviceAuth>
