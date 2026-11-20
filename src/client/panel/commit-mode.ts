/**
 * Commit variants offered by the commit box's action menu. Pure data, so the
 * panel hooks, the presentational menu and the tests share one vocabulary.
 */

/** Commit variants offered by the commit box's action menu. */
export type CommitMode = 'commit' | 'amend' | 'commit-push' | 'commit-sync'

/** Modes that may ask to stage every change before committing. */
export type StageAllCommitMode = Exclude<CommitMode, 'amend'>
