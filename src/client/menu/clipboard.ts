/**
 * Path resolution and clipboard copy for the copy commands.
 */

import type { LocaleBinder } from '../types/dsh.ts'

/**
 * Join a repository-relative path below the captured repository root.
 * @param cwd - repository root; native separators are preserved.
 * @param path - repository-relative path.
 * @returns absolute path for display and copying.
 */
export function absolutePath(cwd: string, path: string): string {
  if (typeof cwd !== 'string' || cwd === '') return path
  const base = cwd.replace(/[\\/]+$/, '')
  if (base === '') return path
  const windows = base.includes('\\') && !base.includes('/')
  return windows ? `${base}\\${path.replaceAll('/', '\\')}` : `${base}/${path}`
}

/**
 * Copy text through the async clipboard API, falling back to the selection
 * based copy used by older WebViews.
 * @param text - text to copy.
 * @returns whether a clipboard write succeeded.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
  if (clipboard !== undefined && clipboard !== null && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text)
      return true
    } catch {
      // Fall through to the selection based copy used by older WebViews.
    }
  }
  try {
    if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    document.body.appendChild(area)
    try {
      area.select()
      return document.execCommand('copy') !== false
    } finally {
      document.body.removeChild(area)
    }
  } catch {
    return false
  }
}

/**
 * Copy one value and report the outcome through the host toast.
 * @param t - locale binder.
 * @param notify - host toast callback.
 * @param text - text to copy.
 * @param successKey - dictionary key reported on success.
 * @returns resolves after the toast attempt.
 */
export async function copyAndReport(
  t: LocaleBinder,
  notify: ((text: string, success: boolean) => void) | undefined,
  text: string,
  successKey: string,
): Promise<void> {
  const copied = await copyToClipboard(String(text))
  if (typeof notify !== 'function') return
  try {
    notify(copied ? t(successKey) : t('menu.copyFailed'), copied)
  } catch (error) {
    console.warn('[git-graph] copy feedback failed', error)
  }
}
