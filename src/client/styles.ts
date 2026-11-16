/**
 * Install the plugin stylesheet into one document.
 *
 * The bundle factory must stay side-effect free, so nothing here touches the
 * DOM at module evaluation. `apply` calls {@link installStyles} through
 * `ctx.effect` and owns the returned disposer.
 */

import { PACKAGE_ID } from './constants.ts'
import CSS from './styles.css'

/** One document's style tag and how many plugin lifetimes currently hold it. */
interface StyleLease {
  /** The style element this document renders. */
  readonly tag: HTMLStyleElement
  /** Whether this module created the tag (as opposed to adopting an existing one). */
  readonly owned: boolean
  /** Number of live disposers. */
  count: number
}

/**
 * Well-known global key for the per-document lease table.
 *
 * Module reloads (the page's plugin hot-swap) replace this module, so the table
 * cannot live only in module scope: the incoming copy and the outgoing cleanup
 * must see the same hold count or one of them would remove a tag the other is
 * still using.
 */
const STYLE_REGISTRY = Symbol.for('@local/dsh-git-graph/styles')

/** Host object carrying the shared lease table across module instances. */
type StyleRegistryHost = typeof globalThis & { [key: symbol]: unknown }

/** This module instance's view of the shared table; created on first install. */
let leases: WeakMap<Document, StyleLease> | undefined

/**
 * Read the shared lease table, creating it on first use.
 *
 * Deliberately lazy: module evaluation must not publish anything, even an
 * invisible registry, before `apply` runs.
 * @returns the document lease table shared with every module instance.
 */
function leaseTable(): WeakMap<Document, StyleLease> {
  if (leases !== undefined) return leases
  const host = globalThis as StyleRegistryHost
  const registered = host[STYLE_REGISTRY]
  leases =
    registered instanceof WeakMap
      ? (registered as WeakMap<Document, StyleLease>)
      : new WeakMap<Document, StyleLease>()
  host[STYLE_REGISTRY] = leases
  return leases
}

/**
 * Ensure the plugin stylesheet exists in one document.
 *
 * Idempotent per document and safe to call from every plugin lifetime: the
 * first caller creates the tag, later callers share it, and each returned
 * disposer releases one hold. The tag is removed only after the last hold and
 * only when this module created it; an existing tag from another bundle
 * instance is adopted, never removed.
 * @param target - document to install into; defaults to the global document.
 * @returns disposer releasing this install.
 */
export function installStyles(target?: Document): () => void {
  const doc = target ?? (typeof document === 'undefined' ? undefined : document)
  if (doc === undefined) return () => {}
  const table = leaseTable()
  let lease = table.get(doc)
  if (lease === undefined) {
    const selector = `style[data-plugin=${JSON.stringify(PACKAGE_ID)}]`
    const existing = doc.querySelector<HTMLStyleElement>(selector)
    if (existing !== null) {
      lease = { tag: existing, owned: false, count: 0 }
    } else {
      const tag = doc.createElement('style')
      tag.setAttribute('data-plugin', PACKAGE_ID)
      tag.textContent = CSS
      doc.head.appendChild(tag)
      lease = { tag, owned: true, count: 0 }
    }
    table.set(doc, lease)
  }
  // A replacement module may carry new CSS while the outgoing lifetime still holds a lease.
  if (lease.tag.textContent !== CSS) lease.tag.textContent = CSS
  const acquired = lease
  acquired.count += 1
  let active = true
  return () => {
    if (!active) return
    active = false
    acquired.count -= 1
    if (acquired.count > 0) return
    table.delete(doc)
    if (acquired.owned) acquired.tag.remove()
  }
}
