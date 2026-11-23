#!/usr/bin/env node
// Copies the upstream skills listed in sources.json into vendor/<source>/,
// each pinned to its commit, with its license and an ATTRIBUTION.md, then
// checks every skill in the repository.
//
//   node scripts/sync.mjs            sync vendor/ from sources.json
//   node scripts/sync.mjs --check    fail if vendor/ differs from sources.json
//   node scripts/sync.mjs --latest   move every source to its default branch's
//                                    newest commit, then sync
//   node scripts/sync.mjs --validate only check the skills already in the repo
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const MANIFEST = join(ROOT, 'sources.json')
const ALLOWED_LICENSES = new Set(['MIT', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'ISC'])
// Text that identifies each license in an upstream license file.
const LICENSE_MARKERS = {
  MIT: /MIT License|Permission is hereby granted, free of charge/i,
  'Apache-2.0': /Apache License,?\s+Version 2\.0/i,
  'BSD-2-Clause': /Redistribution and use in source and binary forms/i,
  'BSD-3-Clause': /Redistribution and use in source and binary forms/i,
  ISC: /Permission to use, copy, modify, and\/or distribute/i
}

const args = new Set(process.argv.slice(2))
const fail = (message) => {
  console.error(`error: ${message}`)
  process.exit(1)
}

function readManifest() {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  for (const [name, source] of Object.entries(manifest.sources ?? {})) {
    if (!/^[a-z0-9-]+$/.test(name)) fail(`source name ${name} must be lower-case letters, digits or -`)
    if (!/^[\w.-]+\/[\w.-]+$/.test(source.repo ?? '')) fail(`${name}: repo must be owner/name`)
    if (!/^[0-9a-f]{40}$/.test(source.commit ?? '')) fail(`${name}: commit must be a full 40-character SHA`)
    if (!ALLOWED_LICENSES.has(source.license)) fail(`${name}: license ${source.license} is not allowed`)
    if (!Array.isArray(source.skills) || !source.skills.length) fail(`${name}: list at least one skill`)
  }
  return manifest
}

/** Downloads one commit of a repository and returns the folder it unpacked to. */
function download(repo, commit, into) {
  const archive = join(into, 'source.tar.gz')
  execFileSync('curl', ['-sSfL', '-o', archive, `https://codeload.github.com/${repo}/tar.gz/${commit}`])
  execFileSync('tar', ['-xzf', archive, '-C', into])
  const folder = readdirSync(into).find((entry) => entry !== 'source.tar.gz')
  if (!folder) fail(`${repo}@${commit}: empty archive`)
  return join(into, folder)
}

/** The newest commit on a repository's default branch (needs `gh`). */
function latestCommit(repo) {
  return execFileSync('gh', ['api', `repos/${repo}/commits/HEAD`, '--jq', '.sha'], { encoding: 'utf8' }).trim()
}

/** Splits a SKILL.md into its frontmatter lines and body. */
function splitFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
  if (!match) return null
  return { lines: match[1].split(/\r?\n/), body: text.slice(match[0].length) }
}

function frontmatterValue(lines, key) {
  const line = lines.find((entry) => entry.startsWith(`${key}:`))
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : undefined
}

/**
 * Sets the frontmatter fields RooAGI relies on: `license` as an SPDX ID (some
 * upstream skills write "see LICENSE.txt") and `source`, where it came from.
 * The skill's text is otherwise unchanged.
 */
function stampFrontmatter(path, license, origin, rename) {
  const parsed = splitFrontmatter(readFileSync(path, 'utf8'))
  if (!parsed) fail(`${path}: SKILL.md has no frontmatter`)
  const lines = parsed.lines
    .filter((line) => !/^(license|source):/.test(line))
    .map((line) => (rename && line.startsWith('name:') ? `name: ${rename}` : line))
  lines.push(`license: ${license}`, `source: ${origin}`)
  writeFileSync(path, `---\n${lines.join('\n')}\n---\n${parsed.body}`)
}

/**
 * The skill folders a source lists. `folder/*` means every skill folder under
 * `folder` (at any depth); `exclude` removes skills by folder name.
 */
function expandSkills(upstream, source) {
  const found = []
  const walk = (folder) => {
    if (existsSync(join(folder, 'SKILL.md'))) return found.push(relative(upstream, folder))
    for (const entry of readdirSync(folder)) {
      const path = join(folder, entry)
      if (statSync(path).isDirectory()) walk(path)
    }
  }
  const out = []
  for (const entry of source.skills) {
    if (!entry.endsWith('/*')) {
      out.push({ path: entry, explicit: true })
      continue
    }
    found.length = 0
    const base = join(upstream, entry.slice(0, -2))
    if (!existsSync(base)) fail(`${source.repo}: ${entry} not found at ${source.commit}`)
    walk(base)
    for (const path of found.sort()) out.push({ path, explicit: false })
  }
  const excluded = new Set(source.exclude ?? [])
  return out.filter(({ path }) => !excluded.has(basename(path)))
}

/** Copies the listed skills of every source into `vendorRoot`. */
function sync(manifest, vendorRoot) {
  rmSync(vendorRoot, { recursive: true, force: true })
  mkdirSync(vendorRoot, { recursive: true })
  // RooAGI's own skills keep their names; a later source that reuses a name
  // gets it prefixed with the source name.
  const taken = new Set(ownSkillNames())
  for (const [name, source] of Object.entries(manifest.sources)) {
    const work = mkdtempSync(join(tmpdir(), `rooagi-skills-${name}-`))
    try {
      const upstream = download(source.repo, source.commit, work)
      const target = join(vendorRoot, name)
      mkdirSync(target, { recursive: true })
      const perSkill = source.licenseFile?.startsWith('per-skill:')
        ? source.licenseFile.slice('per-skill:'.length)
        : undefined
      if (!perSkill) {
        const licensePath = join(upstream, source.licenseFile ?? 'LICENSE')
        if (!existsSync(licensePath)) fail(`${name}: ${source.licenseFile ?? 'LICENSE'} not found upstream`)
        checkLicenseText(name, licensePath, source.license)
        cpSync(licensePath, join(target, 'LICENSE'))
      }
      const copied = []
      const skipped = []
      for (const { path: skillPath, explicit } of expandSkills(upstream, source)) {
        const from = join(upstream, skillPath)
        if (!existsSync(join(from, 'SKILL.md'))) fail(`${name}: ${skillPath}/SKILL.md not found at ${source.commit}`)
        if (perSkill) {
          const licensePath = join(from, perSkill)
          const ok = existsSync(licensePath) && LICENSE_MARKERS[source.license].test(readFileSync(licensePath, 'utf8'))
          if (!ok) {
            // A listed skill must be permissive; one found under a folder is skipped.
            if (explicit) fail(`${name}/${basename(skillPath)}: ${perSkill} missing or not ${source.license}`)
            skipped.push(`${skillPath} (no ${source.license} ${perSkill})`)
            continue
          }
        }
        const upstreamName =
          frontmatterValue(splitFrontmatter(readFileSync(join(from, 'SKILL.md'), 'utf8'))?.lines ?? [], 'name') ??
          basename(skillPath)
        const skill = taken.has(upstreamName) ? `${name}-${upstreamName}` : upstreamName
        if (taken.has(skill)) {
          skipped.push(`${skillPath} (name ${upstreamName} already taken)`)
          continue
        }
        taken.add(skill)
        const to = join(target, skill)
        cpSync(from, to, { recursive: true })
        stampFrontmatter(
          join(to, 'SKILL.md'),
          source.license,
          `https://github.com/${source.repo}/tree/${source.commit}/${skillPath}`,
          skill === upstreamName ? undefined : skill
        )
        const notes = join(ROOT, 'notes', name, `${skill}.md`)
        if (existsSync(notes)) {
          const skillFile = join(to, 'SKILL.md')
          writeFileSync(skillFile, `${readFileSync(skillFile, 'utf8').trimEnd()}\n\n${readFileSync(notes, 'utf8').trim()}\n`)
        }
        copied.push({ skill, skillPath })
      }
      if (skipped.length) console.log(`${name}: skipped ${skipped.length}:\n  ${skipped.join('\n  ')}`)
      console.log(`${name}: ${copied.length} skills`)
      writeFileSync(join(target, 'ATTRIBUTION.md'), attribution(name, source, copied, perSkill))
    } finally {
      rmSync(work, { recursive: true, force: true })
    }
  }
}

function ownSkillNames() {
  const root = join(ROOT, 'rooagi')
  if (!existsSync(root)) return []
  return readdirSync(root)
    .map((entry) => join(root, entry, 'SKILL.md'))
    .filter((path) => existsSync(path))
    .map((path) => frontmatterValue(splitFrontmatter(readFileSync(path, 'utf8'))?.lines ?? [], 'name'))
    .filter(Boolean)
}

function checkLicenseText(label, path, license) {
  if (!LICENSE_MARKERS[license].test(readFileSync(path, 'utf8')))
    fail(`${label}: ${relative(ROOT, path)} does not read as ${license}`)
}

function attribution(name, source, copied, perSkill) {
  return [
    `# ${name}`,
    '',
    `These skills are copied from https://github.com/${source.repo} at commit`,
    `\`${source.commit}\`, under the ${source.license} license.`,
    perSkill
      ? `Each skill's license is in its own \`${perSkill}\`.`
      : 'The upstream license is in `LICENSE` beside this file.',
    '',
    'RooAGI sets `license` and `source` in each SKILL.md frontmatter, renames a skill',
    `to \`${name}-<name>\` when another skill already has its name, and may append a`,
    '"RooAGI notes" section from `notes/' + name + '/`; the rest is unchanged.',
    '',
    ...copied.map(({ skill, skillPath }) => `- \`${skill}\`: \`${skillPath}\``),
    ''
  ].join('\n')
}

/** Checks every SKILL.md in rooagi/ and vendor/: frontmatter, license and unique names. */
function validate() {
  const names = new Map()
  const problems = []
  const visit = (folder) => {
    if (!existsSync(folder)) return
    for (const entry of readdirSync(folder)) {
      const path = join(folder, entry)
      if (!statSync(path).isDirectory()) continue
      const skillFile = join(path, 'SKILL.md')
      if (existsSync(skillFile)) {
        const parsed = splitFrontmatter(readFileSync(skillFile, 'utf8'))
        const where = relative(ROOT, skillFile)
        if (!parsed) {
          problems.push(`${where}: no frontmatter`)
          continue
        }
        const name = frontmatterValue(parsed.lines, 'name')
        const description = frontmatterValue(parsed.lines, 'description')
        const license = frontmatterValue(parsed.lines, 'license')
        if (!name) problems.push(`${where}: no name`)
        if (!description) problems.push(`${where}: no description`)
        if (!ALLOWED_LICENSES.has(license)) problems.push(`${where}: license ${license ?? '(none)'} is not allowed`)
        if (name && names.has(name)) problems.push(`${where}: name ${name} is also used by ${names.get(name)}`)
        if (name) names.set(name, where)
      } else visit(path)
    }
  }
  visit(join(ROOT, 'rooagi'))
  visit(join(ROOT, 'vendor'))
  if (problems.length) fail(`\n  ${problems.join('\n  ')}`)
  console.log(`${names.size} skills valid`)
}

function sameTree(a, b) {
  const list = (root) =>
    existsSync(root)
      ? execFileSync('find', ['.', '-type', 'f'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean).sort()
      : []
  const left = list(a)
  const right = list(b)
  if (left.join('\n') !== right.join('\n')) return false
  return left.every((file) => readFileSync(join(a, file)).equals(readFileSync(join(b, file))))
}

const manifest = readManifest()
if (args.has('--validate')) {
  validate()
} else if (args.has('--check')) {
  const fresh = mkdtempSync(join(tmpdir(), 'rooagi-skills-check-'))
  try {
    sync(manifest, join(fresh, 'vendor'))
    if (!sameTree(join(fresh, 'vendor'), join(ROOT, 'vendor')))
      fail('vendor/ does not match sources.json: run `node scripts/sync.mjs` and commit the result')
    console.log('vendor/ matches sources.json')
    validate()
  } finally {
    rmSync(fresh, { recursive: true, force: true })
  }
} else {
  if (args.has('--latest')) {
    for (const source of Object.values(manifest.sources)) source.commit = latestCommit(source.repo)
    writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  }
  sync(manifest, join(ROOT, 'vendor'))
  validate()
}
