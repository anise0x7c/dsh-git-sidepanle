/**
 * The trust fence for the plugin's local route family.
 *
 * A request must come from the same-origin Web GUI on the same Host: an
 * unproxied loopback socket, a loopback Host header, same-origin browser
 * markers, and the bundle's own request header so a cross-site form post
 * cannot forge a call. This module is a leaf: no project imports.
 */
import type { IncomingMessage } from 'node:http'

/**
 * Whether a socket address names loopback.
 * @param address - socket remote address.
 * @returns true for 127/8, ::1, and IPv4-mapped loopback.
 */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (typeof address !== 'string') return false
  const normalized = address.toLowerCase()
  if (normalized === '::1') return true
  if (normalized.startsWith('::ffff:')) return isLoopbackAddress(normalized.slice(7))
  const parts = normalized.split('.')
  return (
    parts.length === 4 &&
    parts[0] === '127' &&
    parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  )
}

/**
 * Whether a Host header names a loopback authority.
 * @param hostname - URL hostname.
 * @returns true for localhost and loopback literals.
 */
export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '[::1]' || isLoopbackAddress(hostname)
}

/**
 * The same local-request fence the other local plugin routes use: an unproxied
 * loopback socket, a loopback Host header, same-origin browser markers, and the
 * bundle's own request header so a cross-site form post cannot forge a call.
 * @param request - Node request.
 * @returns whether the request may enter.
 */
export function isTrustedRequest(request: IncomingMessage): boolean {
  if (request.headers['x-dsh-git-sidepanel'] !== '1') return false
  if (
    request.headers['x-forwarded-for'] !== undefined ||
    request.headers['cf-connecting-ip'] !== undefined
  )
    return false
  if (!isLoopbackAddress(request.socket?.remoteAddress)) return false
  const host = request.headers.host
  if (typeof host !== 'string' || host === '') return false
  let hostUrl: URL
  try {
    hostUrl = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (!isLoopbackHostname(hostUrl.hostname)) return false
  const site = request.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin') return false
  const origin = request.headers.origin
  if (origin === undefined || origin === '') return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}
