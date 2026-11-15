/**
 * Change actions: the single-busy-lock wrapper, stage/unstage/discard/commit,
 * the commit message, transient notices, action failures, and the confirmation
 * dialog that guards discards and "commit everything".
 */

import { useCallback, useEffect, useState } from 'react'
import { makeFailure } from '../../data/caller.js'

/**
 * Own the panel's mutating actions. Every action runs through `perform` so only
 * one Host write is in flight, the status is refreshed silently afterwards, and
 * failures surface as a dismissible banner.
 * @param {object} options - hook inputs.
 * @param {Function} options.call - panel RPC caller.
 * @param {Function} options.t - locale binder.
 * @param {object} options.refs - shared panel refs (see `usePanelRefs`).
 * @param {object[]} options.files - all changed files from the status.
 * @param {object[]} options.stagedFiles - staged files from the status.
 * @param {Function} options.loadStatus - silent status refresh.
 * @param {Function} options.loadGraph - graph refresh.
 * @returns {object} action state and handlers.
 */
export function useChangeActions({ call, t, refs, files, stagedFiles, loadStatus, loadGraph }) {
  const [actionFailure, setActionFailure] = useState(null)
  const [busy, setBusy] = useState(null)
  const [message, setMessage] = useState('')
  const [notice, setNotice] = useState(null)
  const [confirm, setConfirm] = useState(null)
  refs.busy.current = busy
  refs.confirm.current = confirm

  useEffect(() => {
    if (notice === null) return undefined
    const timer = setTimeout(() => { if (refs.mounted.current) setNotice(null) }, 4000)
    return () => clearTimeout(timer)
  }, [notice, refs])

  const perform = useCallback(async (name, operation, options = {}) => {
    if (refs.busy.current !== null) return undefined
    refs.busy.current = name
    setBusy(name)
    setActionFailure(null)
    try {
      const result = await operation()
      if (!refs.mounted.current) return result
      if (options.notice !== undefined) setNotice(options.notice)
      if (options.after !== undefined) await options.after(result)
      await loadStatus({ silent: true })
      if (options.graph === true) await loadGraph()
      return result
    } catch (error) {
      if (refs.mounted.current) setActionFailure(error)
      return undefined
    } finally {
      refs.busy.current = null
      if (refs.mounted.current) setBusy(null)
    }
  }, [refs, loadStatus, loadGraph])

  const stage = (entries) => perform('stage', () => call('stage', { paths: entries.map((entry) => entry.path) }))
  const unstage = (entries) => perform('unstage', () => call('unstage', { paths: entries.map((entry) => entry.path) }))

  const requestCommit = () => {
    if (message.trim() === '' || refs.busy.current !== null) return
    if (stagedFiles.length === 0) {
      if (files.length === 0) {
        setActionFailure(makeFailure('nothing-staged', t('commit.nothing')))
        return
      }
      setConfirm({ kind: 'commitAll' })
      return
    }
    void perform('commit', () => call('commit', { message }), {
      graph: true,
      after: (result) => {
        setMessage('')
        setNotice(t('commit.done', { hash: result?.commit ?? '' }))
      },
    })
  }

  const confirmAction = () => {
    const current = refs.confirm.current
    if (current === null) return
    setConfirm(null)
    if (current.kind === 'commitAll') {
      void perform('commit', () => call('commit', { message, stageAll: true }), {
        graph: true,
        after: (result) => {
          setMessage('')
          setNotice(t('commit.done', { hash: result?.commit ?? '' }))
        },
      })
      return
    }
    if (current.kind === 'discard') {
      void perform('discard', () => call('discard', { path: current.entry.path, untracked: current.entry.untracked === true }))
      return
    }
    if (current.kind === 'discardAll') {
      const entries = current.entries
      void perform('discard', async () => {
        for (const entry of entries) await call('discard', { path: entry.path, untracked: entry.untracked === true })
      })
    }
  }

  return {
    actionFailure,
    setActionFailure,
    busy,
    message,
    setMessage,
    notice,
    setNotice,
    confirm,
    setConfirm,
    perform,
    stage,
    unstage,
    requestCommit,
    confirmAction,
  }
}
