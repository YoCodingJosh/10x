#!/usr/bin/env node
/**
 * Interactive version bump — arrow keys + enter, release notes, commit & push;
 * then GitHub Actions tags, publishes the release, and release-build uploads artifacts.
 * Run: npm run bump
 *
 * Requires: GitHub CLI (`gh`) with `repo` scope — `gh auth login`
 */
import { readFileSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  cancel,
  intro,
  isCancel,
  log,
  outro,
  select,
  text,
} from '@clack/prompts'
import color from 'picocolors'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const pkgPath = join(root, 'package.json')

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    ...opts,
  })
  if (spawnFailed(r)) process.exit(r?.status ?? 1)
}

function spawnFailed(r) {
  if (r.error) throw r.error
  return r.status !== 0
}

function bumpSemver(version, part) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim())
  if (!m) {
    log.error(`Expected X.Y.Z version, got: ${version}`)
    process.exit(1)
  }
  let [major, minor, patch] = [m[1], m[2], m[3]].map(Number)
  if (part === 'major') {
    major += 1
    minor = 0
    patch = 0
  } else if (part === 'minor') {
    minor += 1
    patch = 0
  } else {
    patch += 1
  }
  return `${major}.${minor}.${patch}`
}

function dispatchPublishWorkflow(branch, version, releaseNotes) {
  const payload = JSON.stringify({
    ref: branch,
    inputs: {
      version,
      release_notes: releaseNotes,
    },
  })
  const r = spawnSync(
    'gh',
    [
      'api',
      '--method',
      'POST',
      'repos/{owner}/{repo}/actions/workflows/release-publish.yml/dispatches',
      '--input',
      '-',
    ],
    {
      cwd: root,
      input: payload,
      encoding: 'utf8',
    },
  )
  if (spawnFailed(r)) {
    if (r.stderr) process.stderr.write(r.stderr)
    if (r.stdout) process.stdout.write(r.stdout)
    log.error(
      '`gh api` failed — your commit is on the remote; create the tag/release manually if needed.',
    )
    process.exit(r.status ?? 1)
  }
}

async function collectReleaseNotes() {
  if (!process.stdin.isTTY) {
    const notes = await text({
      message: `${color.bold('Release notes')} ${color.dim('(markdown)')}`,
      placeholder: 'Summarize this release for users',
      validate: (v) =>
        v?.trim() ? undefined : 'Add a short description (or one bullet).',
    })
    if (isCancel(notes)) {
      cancel('Alright, maybe later.')
      process.exit(0)
    }
    return notes.trim()
  }

  const dir = mkdtempSync(join(tmpdir(), '10x-release-notes-'))
  const file = join(dir, 'NOTES.md')
  writeFileSync(
    file,
    `## What changed\n\n- \n`,
    'utf8',
  )
  const editor =
    process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'nano')
  log.step(
    `${color.dim('Opening')} ${color.cyan(editor)} ${color.dim('— save and close when done')}`,
  )
  const ed = spawnSync(editor, [file], { stdio: 'inherit', cwd: root })
  let body
  try {
    body = readFileSync(file, 'utf8')
  } catch {
    body = ''
  }
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* ignore */
  }
  if (spawnFailed(ed)) {
    log.error('Editor exited with an error.')
    process.exit(ed?.status ?? 1)
  }
  const trimmed = body.trim()
  if (!trimmed) {
    log.error('Release notes are empty.')
    process.exit(1)
  }
  return body
}

async function main() {
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const current = pkg.version
  if (typeof current !== 'string') {
    log.error('package.json has no string "version"')
    process.exit(1)
  }

  intro(color.inverse(color.bold(' 10x version bump ')))

  log.message(
    `${color.dim('Current')}\n${color.bold(color.cyan(current))}`,
  )

  const part = await select({
    message: `${color.bold('Bump level')} ${color.dim('(↑↓ enter)')}`,
    options: [
      {
        value: 'patch',
        label: `${color.green('Patch')}  ${color.dim('bugfix · x.y.Z → x.y.(Z+1)')}`,
        hint: 'Ship small fixes',
      },
      {
        value: 'minor',
        label: `${color.yellow('Minor')}  ${color.dim('features · x.y.z → x.(Y+1).0')}`,
        hint: 'New stuff, backwards compatible',
      },
      {
        value: 'major',
        label: `${color.magenta('Major')}  ${color.dim('breaking · x.y.z → (X+1).0.0')}`,
        hint: 'API / behavior breaks',
      },
    ],
    initialValue: 'patch',
  })

  if (isCancel(part)) {
    cancel('Alright, maybe later.')
    process.exit(0)
  }

  const next = bumpSemver(current, part)
  log.success(
    `${color.dim('Next release')}  ${color.strikethrough(color.dim(current))}  ${color.bold(color.cyan('→'))}  ${color.bold(color.cyan(next))}`,
  )

  const releaseNotes = await collectReleaseNotes()

  const ghCheck = spawnSync('gh', ['auth', 'status'], {
    cwd: root,
    stdio: 'pipe',
  })
  if (ghCheck.error?.code === 'ENOENT') {
    log.error(
      'GitHub CLI (`gh`) was not found. Install it from https://cli.github.com and re-run.',
    )
    process.exit(1)
  }
  if (spawnFailed(ghCheck)) {
    log.error(
      '`gh` is not authenticated. Run `gh auth login`, then re-run `pnpm run bump`.',
    )
    process.exit(1)
  }

  pkg.version = next
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')

  log.step('pnpm install (refresh lockfile)…')
  run('pnpm', ['install'])

  log.step('git add package.json & pnpm-lock.yaml…')
  run('git', ['add', 'package.json', 'pnpm-lock.yaml'])

  log.step(`git commit — ${color.dim('chore: bump version to ' + next)}…`)
  run('git', ['commit', '-m', `chore: bump version to ${next}`])

  const branch =
    spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).stdout?.trim() ?? 'main'

  log.step(`git push origin ${color.cyan(branch)}…`)
  run('git', ['push', 'origin', branch])

  log.step(
    `Start ${color.cyan('Publish release')} workflow ${color.dim('(tag + GitHub Release → CI builds)')}…`,
  )
  dispatchPublishWorkflow(branch, next, releaseNotes)

  outro(
    color.green(
      `Queued — watch Actions: tag ${color.bold(next)} will appear, then release assets build.`,
    ),
  )
}

main().catch((e) => {
  log.error(String(e))
  process.exit(1)
})
