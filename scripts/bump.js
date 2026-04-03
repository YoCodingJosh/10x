#!/usr/bin/env node
/**
 * Interactive version bump — arrow keys + enter, commit & tag.
 * Run: npm run bump
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  select,
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

  pkg.version = next
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')

  log.step('npm install (refresh lockfile)…')
  run('npm', ['install'])

  log.step('git add package.json & package-lock.json…')
  run('git', ['add', 'package.json', 'package-lock.json'])

  log.step(`git commit — ${color.dim('chore: bump version to ' + next)}…`)
  run('git', ['commit', '-m', `chore: bump version to ${next}`])

  log.step(`git tag ${color.cyan(next)}…`)
  run('git', ['tag', next])

  const shouldPush = await confirm({
    message: `Push branch + tag ${color.cyan(next)} to ${color.bold('origin')}?`,
    initialValue: false,
  })

  if (isCancel(shouldPush)) {
    cancel('Skipped push.')
    log.info(`When ready:\n  ${color.dim(`git push origin $(git rev-parse --abbrev-ref HEAD) && git push origin ${next}`)}`)
    process.exit(0)
  }

  if (shouldPush) {
    const branch =
      spawnSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: root,
        encoding: 'utf8',
      }).stdout?.trim() ?? 'main'
    log.step(`git push origin ${color.cyan(branch)}…`)
    run('git', ['push', 'origin', branch])
    log.step(`git push origin ${color.cyan(next)}…`)
    run('git', ['push', 'origin', next])
    outro(color.green(`You’re live — draft a GitHub Release on ${color.bold(next)} when builds should run.`))
  } else {
    outro(
      `${color.yellow('Tag stays local.')}\n${color.dim(`git push origin $(git rev-parse --abbrev-ref HEAD)`)}${color.dim('\ngit push origin ' + next)}`,
    )
  }
}

main().catch((e) => {
  log.error(String(e))
  process.exit(1)
})
