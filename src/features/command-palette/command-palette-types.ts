export type CommandPaletteItem = {
  id: string
  label: string
  keywords?: string
  section: 'go' | 'git' | 'shell' | 'workspace' | 'agent'
}
