/** Retire dsh 0.1.5 link-backend projections without traversing junction targets. */
import { lstatSync, readdirSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { cleanupDisposableTree } from './disposable-tree.ts'
import { isLinkedPath, linkedPathTarget, removeLinkedPath, sameResolvedPath } from './fs-links.ts'

/** Directory where the dsh 0.1.5 link backend projected bundle-carried packages into a profile. */
export const LINK_PROJECTION_DIR = '.dsh-module-fallback'

/**
 * Top-level and scoped `node_modules` entries that are symlinks or junctions.
 *
 * `Dirent.isSymbolicLink()` misses Windows junctions the same way `lstat` does, so each candidate
 * is resolved through `isLinkedPath` instead.
 */
function symlinksUnder(modules: string): string[] {
  const links: string[] = []
  let entries
  try {
    entries = readdirSync(modules, { withFileTypes: true })
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return links
    throw cause
  }
  for (const entry of entries) {
    const path = join(modules, entry.name)
    if (isLinkedPath(path)) {
      links.push(path)
    } else if (entry.name.startsWith('@') && entry.isDirectory()) {
      for (const child of readdirSync(path, { withFileTypes: true })) {
        const childPath = join(path, child.name)
        if (isLinkedPath(childPath)) links.push(childPath)
      }
    }
  }
  return links
}

/**
 * Whether `link` mirrors a projection entry inside `ownedModules`.
 *
 * `readlink` cannot answer this on Windows: it fails with EINVAL for a junction, and resolving the
 * link fully skips the intermediate projection hop. Instead the mirror entry that owns the same
 * relative path is resolved too — a projection link and its mirror land on the same target, while a
 * pnpm-managed link has no mirror and a link pointing anywhere else resolves differently.
 */
function pointsInto(link: string, linkRoot: string, ownedModules: string): boolean {
  const rel = relative(linkRoot, link)
  if (rel.length === 0 || rel.startsWith('..') || isAbsolute(rel)) return false
  const target = linkedPathTarget(link)
  if (target === undefined) return false
  const mirrorTarget = linkedPathTarget(join(ownedModules, rel))
  if (mirrorTarget === undefined) return false
  return sameResolvedPath(mirrorTarget, target)
}

/**
 * Remove the package projections a dsh 0.1.5 link-backend launch left in one profile.
 *
 * Selection matches upstream `removeLinkProjections`: only `node_modules` links whose
 * target lies inside `<profile>/.dsh-module-fallback/node_modules` are unlinked, then that
 * directory is removed; pnpm-installed packages and every other link stay.
 *
 * Upstream finishes with `rmSync(owned, { recursive: true })`. The projection directory
 * holds junctions into a Desktop installation, and Electron 44's Node (24.18.1) follows
 * those junctions during a recursive `rmSync`, emptying the installation packages they
 * point to. Desktop therefore never calls the upstream helper and removes every link
 * itself without visiting its target.
 * @param dir - the profile directory.
 * @returns whether a projection directory was present.
 */
export function removeLinkProjectionsSafely(dir: string): boolean {
  const owned = join(dir, LINK_PROJECTION_DIR)
  if (lstatSync(owned, { throwIfNoEntry: false }) === undefined) return false
  const ownedModules = join(owned, 'node_modules')
  const linkRoot = join(dir, 'node_modules')
  for (const link of symlinksUnder(linkRoot)) {
    if (pointsInto(link, linkRoot, ownedModules)) removeLinkedPath(link)
  }
  cleanupDisposableTree(owned)
  return true
}
