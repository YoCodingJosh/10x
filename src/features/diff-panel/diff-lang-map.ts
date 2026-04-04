import type { BundledLanguage } from '@/lib/shiki-highlighter'

const EXT_MAP: Record<string, BundledLanguage> = {
  // TypeScript / JavaScript
  ts: 'typescript',
  tsx: 'tsx',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'jsx',
  mjs: 'javascript',
  cjs: 'javascript',
  // Python
  py: 'python',
  pyw: 'python',
  pyi: 'python',
  // Systems
  rs: 'rust',
  go: 'go',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',
  cs: 'csharp',
  // JVM
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  scala: 'scala',
  // Web
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  html: 'html',
  htm: 'html',
  vue: 'vue',
  svelte: 'svelte',
  // Data / Config
  json: 'json',
  jsonc: 'jsonc',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  xml: 'xml',
  svg: 'xml',
  // Docs
  md: 'markdown',
  mdx: 'mdx',
  // Shell
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'fish',
  ps1: 'powershell',
  psm1: 'powershell',
  // Scripting
  rb: 'ruby',
  php: 'php',
  pl: 'perl',
  pm: 'perl',
  lua: 'lua',
  r: 'r',
  // Mobile / Cross-platform
  swift: 'swift',
  dart: 'dart',
  // Functional
  hs: 'haskell',
  ex: 'elixir',
  exs: 'elixir',
  // Query
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
  // Infrastructure
  tf: 'terraform',
  prisma: 'prisma',
  // Newer languages
  zig: 'zig',
}

const FILENAME_MAP: Record<string, BundledLanguage> = {
  Dockerfile: 'dockerfile',
  '.dockerignore': 'dotenv',
  '.env': 'dotenv',
  '.env.local': 'dotenv',
  '.env.development': 'dotenv',
  '.env.production': 'dotenv',
  '.env.test': 'dotenv',
  Makefile: 'makefile',
  GNUmakefile: 'makefile',
  'CMakeLists.txt': 'cmake',
  Gemfile: 'ruby',
  Rakefile: 'ruby',
  Brewfile: 'ruby',
}

/**
 * Detect Shiki language from a file path. Returns null for unknown/unsupported files.
 */
export function getLangForPath(filePath: string): BundledLanguage | null {
  const filename = filePath.split('/').pop() ?? filePath

  if (filename in FILENAME_MAP) {
    return FILENAME_MAP[filename]!
  }

  const dotIdx = filename.lastIndexOf('.')
  if (dotIdx === -1) return null

  const ext = filename.slice(dotIdx + 1).toLowerCase()
  return EXT_MAP[ext] ?? null
}
