/**
 * Commit-details state: the commit row the user activated, the metadata and
 * file list read for it, the loading/failure flags, and the back/retry
 * transitions the details view needs.
 */

import { useCallback, useRef, useState } from 'react'

/** The fields a graph row carries into the details header before the Host answers. */
function summaryOf(commit) {
  return {
    oid: commit.oid,
    shortOid: commit.shortOid,
    subject: commit.subject,
    author: commit.author,
    authoredAt: commit.authoredAt,
  }
}

/**
 * Read one commit's details on demand and expose the selection state.
 * Selecting a new commit discards the previous answer; a slow answer for a
 * commit the user already left is ignored.
 * @param {object} options - hook inputs.
 * @param {Function} options.call - panel RPC caller.
 * @param {object} options.refs - shared panel refs (see `usePanelRefs`).
 * @returns {object} commit selection, details, flags and handlers.
 */
export function useCommitDetails({ call, refs }) {
  const [selected, setSelected] = useState(null)
  const [details, setDetails] = useState(null)
  const [loading, setLoading] = useState(false)
  const [failure, setFailure] = useState(null)
  const requestToken = useRef(0)

  const loadCommit = useCallback(async (commit) => {
    requestToken.current += 1
    const token = requestToken.current
    setLoading(true)
    setFailure(null)
    setDetails(null)
    try {
      const value = await call('commit-details', { oid: commit.oid })
      if (!refs.mounted.current || requestToken.current !== token) return
      setDetails({
        commit: value?.commit ?? null,
        files: Array.isArray(value?.files) ? value.files : [],
        truncated: value?.truncated === true,
      })
    } catch (error) {
      if (!refs.mounted.current || requestToken.current !== token) return
      setFailure(error)
    } finally {
      if (refs.mounted.current && requestToken.current === token) setLoading(false)
    }
  }, [call, refs])

  const selectCommit = useCallback((commit) => {
    if (commit === null || commit === undefined) return
    setSelected(summaryOf(commit))
    void loadCommit(commit)
  }, [loadCommit])

  const closeCommit = useCallback(() => {
    requestToken.current += 1
    setSelected(null)
    setDetails(null)
    setFailure(null)
    setLoading(false)
  }, [])

  const retryCommit = useCallback(() => {
    if (selected !== null) void loadCommit(selected)
  }, [loadCommit, selected])

  return { selected, details, loading, failure, selectCommit, closeCommit, retryCommit }
}
