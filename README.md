# 10x

**10x** is a desktop app for running **Claude Code** and **shells** across multiple project folders, with optional **Git worktrees** for isolated agent checkouts. Built with Electron, React, and real terminal sessions (PTY).

## Features

- **Workspaces** — Add several folders; switch between them from the sidebar.
- **Agent sessions** — Multiple Claude Code tabs per workspace; Git repos can use dedicated worktrees under `~/10x-worktrees`.
- **Terminal** — Project-scoped and agent-scoped shells; sessions stay alive when you switch workspaces.
- **Quick actions** — Open the active folder in Cursor, in the file manager, or open the `origin` remote in your browser (when available).

## Requirements

- **Node.js** (LTS recommended) and **npm**
- **macOS** for the current packaged build (Apple Silicon `arm64` DMG). Other platforms would need additional `electron-builder` targets.

You need the **Claude Code** CLI on your `PATH` for agent sessions, and **Cursor** on your `PATH` if you use “open in Cursor.”

## Development

```bash
npm install
npm run dev
```

This runs the Vite dev server and launches the Electron shell. Native modules (`node-pty`) are rebuilt on `npm install` via `postinstall`.

```bash
npm run typecheck
```

## Production build

```bash
npm run build
```

Produces a **DMG** under `release/` (for example `10x-<version>-arm64.dmg`). Install by opening the DMG and dragging **10x** into Applications.

To share builds, upload the DMG to **GitHub Releases** (or another host) and link the download from your project page—avoid committing large binaries to git history.

## Tech stack

- **Electron** + **Vite** + **React** + **TypeScript**
- **xterm.js** for terminal UI
- **node-pty** for shell and Claude Code processes
- **Zustand** for UI state, **TanStack Query** where persistence/sync is used

## License

Private / unlicensed unless you add a `LICENSE` file.
