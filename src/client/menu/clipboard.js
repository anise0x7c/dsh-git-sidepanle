// @ts-check
/**
 * Path resolution and clipboard copy for the copy commands.
 */

/** @typedef {import('../git/format.js').LocaleBinder} LocaleBinder */

/**
 * Join a repository-relative path below the captured repository root.
 * @param {string} cwd - repository root; native separators are preserved.
 * @param {string} path - repository-relative path.
 * @returns {string} absolute path for display and copying.
 */
export function absolutePath(cwd, path) {
  if (typeof cwd !== 'string' || cwd === '') return path
  const base = cwd.replace(/[\\/]+$/, '')
  if (base === '') return path
  const windows = base.includes('\\') && !base.includes('/')
  return windows ? `${base}\\${path.replaceAll('/', '\\')}` : `${base}/${path}`
}

/**
 * Copy text through the async clipboard API, falling back to the selection
 * based copy used by older WebViews.
 * @param {string} text - text to copy.
 * @returns {Promise<boolean>} whether a clipboard write succeeded.
 */
export async function copyToClipboard(text) {
  const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
  if (clipboard !== undefined && clipboard !== null && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text)
      return true
    } catch (error) {
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
    area.select()
    const copied = document.execCommand('copy') !== false
    document.body.removeChild(area)
    return copied
  } catch (error) {
    return false
  }
}

/**
 * Copy one value and report the outcome through the host toast.
 * @param {LocaleBinder} t - locale binder.
 * @param {((text: string, success: boolean) => void) | undefined} notify - host toast callback.
 * @param {string} text - text to copy.
 * @param {string} successKey - dictionary key reported on success.
 * @returns {Promise<void>} resolves after the toast attempt.
 */
export async function copyAndReport(t, notify, text, successKey) {
  const copied = await copyToClipboard(String(text))
  if (typeof notify !== 'function') return
  try {
    notify(copied ? t(successKey) : t('menu.copyFailed'), copied)
  } catch (error) {
    console.warn('[git-graph] copy feedback failed', error)
  }
}
