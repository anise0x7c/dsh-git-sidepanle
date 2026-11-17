/**
 * Render the unified diff the Host returns, coalescing hunk lines into rows.
 */

import type React from 'react'
import { createElement } from 'react'
import { MAX_RENDERED_DIFF_LINES } from '../constants.ts'
import type { DiffResult } from '../types/domain.ts'
import type { LocaleBinder } from '../types/dsh.ts'

const h = createElement

/**
 * Render one diff payload.
 * @param t - locale binder.
 * @param diff - parsed diff, or null before a target is chosen.
 * @returns the diff body.
 */
export function renderDiff(t: LocaleBinder, diff: DiffResult | null | undefined): React.ReactNode {
  if (diff === null || diff === undefined)
    return h('div', { className: 'dshgg-diffNote' }, t('diff.empty'))
  if (diff.binary === true) return h('div', { className: 'dshgg-diffNote' }, t('diff.binary'))
  const hunks = Array.isArray(diff.hunks) ? diff.hunks : []
  if (hunks.length === 0) {
    // A pure rename has no line changes; Git reports the two paths instead.
    if (typeof diff.renameFrom === 'string' && typeof diff.renameTo === 'string') {
      return h('div', { className: 'dshgg-diffNote' }, t('diff.renamed', { path: diff.renameFrom }))
    }
    return h('div', { className: 'dshgg-diffNote' }, t('diff.empty'))
  }
  const rows: React.ReactNode[] = []
  let rendered = 0
  let clipped = false
  if (diff.truncated === true)
    rows.push(h('div', { key: 'truncated', className: 'dshgg-diffNote' }, t('diff.truncated')))
  for (const [index, hunk] of hunks.entries()) {
    rows.push(h('div', { key: `hunk:${index}`, className: 'dshgg-hunkHeader' }, hunk.header ?? ''))
    let oldLine = hunk.oldStart ?? 0
    let newLine = hunk.newStart ?? 0
    for (const [lineIndex, line] of hunk.lines.entries()) {
      if (rendered >= MAX_RENDERED_DIFF_LINES) {
        clipped = true
        break
      }
      let oldNumber = ''
      let newNumber = ''
      if (line.t === ' ') {
        oldNumber = String(oldLine)
        newNumber = String(newLine)
        oldLine += 1
        newLine += 1
      } else if (line.t === '-') {
        oldNumber = String(oldLine)
        oldLine += 1
      } else {
        newNumber = String(newLine)
        newLine += 1
      }
      rows.push(
        h(
          'div',
          { key: `line:${index}:${lineIndex}`, className: 'dshgg-diffLine', 'data-type': line.t },
          h('span', { className: 'dshgg-gutter' }, oldNumber),
          h('span', { className: 'dshgg-gutter' }, newNumber),
          h('span', { className: 'dshgg-marker' }, line.t === ' ' ? '' : line.t),
          h('span', { className: 'dshgg-code' }, line.text === '' ? ' ' : line.text),
        ),
      )
      rendered += 1
    }
    if (clipped) break
  }
  if (clipped)
    rows.push(h('div', { key: 'clipped', className: 'dshgg-diffNote' }, t('diff.truncated')))
  return rows
}
