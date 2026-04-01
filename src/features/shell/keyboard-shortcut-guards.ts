import { useWorkspaceStore } from '@/stores/workspace-store'

export function getVisibleWorkspaceId(): string | null {
  const { workspaces, activeWorkspaceId } = useWorkspaceStore.getState()
  if (workspaces.length === 0) return null
  if (activeWorkspaceId != null && workspaces.some((w) => w.id === activeWorkspaceId)) {
    return activeWorkspaceId
  }
  return workspaces[0]?.id ?? null
}

export function isInsideDialog(el: Element | null): boolean {
  return el?.closest('[role="dialog"]') != null
}

/** True when focus is a text field that should not trigger global shortcuts (xterm is excluded). */
export function isNonTerminalTextField(el: Element | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false
  if (el.closest('.xterm')) return false
  if (el instanceof HTMLTextAreaElement) return true
  if (el instanceof HTMLSelectElement) return true
  if (el instanceof HTMLInputElement) {
    const t = el.type
    if (
      t === 'button' ||
      t === 'checkbox' ||
      t === 'radio' ||
      t === 'submit' ||
      t === 'reset' ||
      t === 'file' ||
      t === 'color' ||
      t === 'range'
    ) {
      return false
    }
    return true
  }
  if (el.isContentEditable) return true
  return false
}
