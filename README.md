# 10x

**10x** is a desktop app for running **Claude Code** and **shells** across multiple project folders, with optional **Git worktrees** for isolated agent checkouts. Built with Electron, React, and real terminal sessions (PTY).

## Install

### macOS (Homebrew)

[Homebrew](https://brew.sh) must be installed. Then:

```bash
brew tap brightsidedeveloper/tap
brew install --cask 10x
```

You can also install from the **DMG** on [GitHub Releases](https://github.com/brightsidedeveloper/10x/releases).

### Linux

Use the **AppImage** from [GitHub Releases](https://github.com/brightsidedeveloper/10x/releases).

## Features

- **Workspaces** — Add several folders; switch between them from the sidebar.
- **Agent sessions** — Multiple Claude Code tabs per workspace; Git repos can use dedicated worktrees (see [Git and worktrees](#git-and-worktrees)).
- **Terminal** — Project-scoped and agent-scoped shells; sessions stay alive when you switch workspaces.
- **Git status & quick action** — One primary control follows the **focused checkout** (main workspace folder or the active agent worktree): pull / stage / commit / push, publish when there is no `origin`, plus GitHub-driven **Create PR** and post-merge **Delete branch** cleanup when connected.
- **Quick actions** — Open the active folder in Cursor, in the file manager, or open the `origin` remote in your browser (when available).

## Git and worktrees

10x can run agents in your **workspace directory** or in a **separate Git worktree** so each agent tab has its own checkout and branch without disturbing the rest of the repo.

### Layout on disk

- Worktrees live under **`~/10x-worktrees/<repo-slug>/<worktree-slug>/`**, where the repo slug is derived from the repository’s top-level folder name.
- Each new worktree gets a local branch named **`10x/<slug>`**, matching the worktree name you choose (if that name is already taken locally, a numeric suffix is appended: `10x/<slug>-1`, etc.).

### Creating and closing agents

- In the agent panel, adding an agent with a **worktree** runs `git worktree add` from the main repo and opens Claude in that path. You can still add “plain” agents that use the workspace folder directly.
- Closing a tab that used a worktree asks for confirmation; cleanup removes the worktree (and tries to delete the linked local branch as part of Git’s worktree removal flow where applicable).

### Session recovery

- After a restart, 10x scans `~/10x-worktrees` for worktrees that belong to your open Git workspaces so you can **re-open agent tabs** that point at those paths instead of losing track of them.

### Status bar workflow

The **Git quick action** reflects the repo that matches what you’re looking at:

- **Behind upstream** → pull first.
- **Unstaged or untracked files** → stage (`git add -A` style).
- **Staged changes** → commit (message dialog).
- **Ahead of upstream** (or no upstream yet while `origin` exists) → push.
- **No `origin`** → publish flow (remote / GitHub) when you hook the repo up.
- With **GitHub** connected (see [GitHub (Settings)](#github-settings)): after a successful push you may get **Create PR** (compare URL in the browser). If the PR for that branch is already **merged**, the app can offer **Delete branch**, which deletes the remote branch and removes the local worktree.

Terminal scope, “open in Cursor,” and the activity-bar Git menu use the same **current path** idea as this control (workspace root vs active agent worktree).

Implementation detail: Git commands and IPC live in [`electron/main/git-ipc.ts`](electron/main/git-ipc.ts).

## Requirements

- **Node.js** (LTS recommended) and **pnpm** (via Corepack or a global install)
- **macOS** or **Linux** for packaged builds. Packaging is still native per platform: build mac artifacts on macOS and Linux artifacts on Linux.

You need the **Claude Code** CLI on your `PATH` for agent sessions, and **Cursor** on your `PATH` if you use “open in Cursor.”

## Development

```bash
pnpm install
pnpm dev
```

This runs the Vite dev server and launches the Electron shell. Native modules (`node-pty`) are rebuilt on `pnpm install` via `postinstall`.

### GitHub (Settings)

End users **do not** configure OAuth: **Connect to GitHub** uses GitHub’s [device flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow) in the browser with a short code.

**If you ship or develop this app:** register one [GitHub OAuth app](https://github.com/settings/developers) for your distribution (callback URL can be `http://localhost`). Then either:

1. Set the **Client ID** in [`electron/main/github-bundled-oauth-id.ts`](electron/main/github-bundled-oauth-id.ts) (recommended for DMGs—end users need no config), or
2. For **local dev**, set `GITHUB_OAUTH_CLIENT_ID` in a `.env` file at the repo root (Electron main loads it on startup via `loadEnvFromAppRoot`).

Optional: `GITHUB_OAUTH_CLIENT_ID` in the process environment overrides both.

```bash
pnpm typecheck
```

## Production build

```bash
pnpm build
```

Builds for the current host platform and writes artifacts under `release/`.

- On **macOS**, `pnpm build` or `pnpm build:mac` produces a **DMG**.
- On **Linux**, `pnpm build` or `pnpm build:linux` produces an **AppImage**.

Published GitHub releases also trigger GitHub Actions to build both targets and upload those artifacts back to the release automatically.

To share builds, use **GitHub Releases** (the repo now has a release workflow for that) or another binary host—avoid committing large binaries to git history.

## Tech stack

- **Electron** + **Vite** + **React** + **TypeScript**
- **xterm.js** for terminal UI
- **node-pty** for shell and Claude Code processes
- **Zustand** for UI state, **TanStack Query** where persistence/sync is used

## License

[MIT](LICENSE)
