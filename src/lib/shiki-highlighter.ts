import { getSingletonHighlighter, type BundledLanguage, type Highlighter } from 'shiki'

const PRELOADED_LANGS: BundledLanguage[] = [
  'typescript',
  'tsx',
  'javascript',
  'jsx',
  'python',
  'rust',
  'go',
  'java',
  'c',
  'cpp',
  'csharp',
  'css',
  'scss',
  'html',
  'json',
  'jsonc',
  'yaml',
  'toml',
  'markdown',
  'mdx',
  'bash',
  'shellscript',
  'ruby',
  'php',
  'swift',
  'kotlin',
  'scala',
  'sql',
  'graphql',
  'vue',
  'svelte',
  'r',
  'xml',
  'dockerfile',
  'lua',
  'haskell',
  'elixir',
  'dart',
  'zig',
  'terraform',
  'prisma',
  'dotenv',
  'makefile',
  'cmake',
  'fish',
  'powershell',
  'perl',
]

let highlighterPromise: Promise<Highlighter> | null = null

export function getShikiHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = getSingletonHighlighter({
      themes: ['github-dark'],
      langs: PRELOADED_LANGS,
    })
  }
  return highlighterPromise
}

export type { BundledLanguage }
