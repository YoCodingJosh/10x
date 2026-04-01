export function workspaceLabelFromPath(dir: string) {
  const parts = dir.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? dir
}
