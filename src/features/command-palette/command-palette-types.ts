export type CommandPaletteItem = {
  id: string
  label: string
  keywords?: string
  section: 'git' | 'shell' | 'workspace' | 'agent'
}
