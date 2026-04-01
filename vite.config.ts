import path from 'node:path'
import { rmSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'

export default defineConfig(({ command }) => {
  rmSync('dist-electron', { recursive: true, force: true })
  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || Boolean(process.env.VSCODE_DEBUG)

  return {
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src'),
      },
    },
    plugins: [
      tailwindcss(),
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler']],
        },
      }),
      electron({
        main: {
          entry: 'electron/main/index.ts',
          onstart(args) {
            if (process.env.VSCODE_DEBUG) {
              console.log('[startup] Electron app')
            } else {
              args.startup()
            }
          },
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: Object.keys(pkg.dependencies ?? {}),
              },
            },
          },
        },
        preload: {
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined,
              minify: isBuild,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                external: Object.keys(pkg.dependencies ?? {}),
              },
            },
          },
        },
        renderer: {},
      }),
    ],
    clearScreen: false,
  }
})
