/**
 * The references the commit graph colors specially, resolved the way VS Code's
 * Git extension resolves them for its Source Control Graph: the checked-out
 * branch (or the detached HEAD commit), that branch's upstream, and its base
 * branch. Every command here only reads; the base branch is never written back
 * to the repository configuration.
 */
import type { GraphReference, GraphReferences } from '../../shared/git.ts'
import { runGit } from './exec.ts'

/** `for-each-ref` format: HEAD marker, ref name, target, upstream, symref target. */
const REF_FORMAT = '%(HEAD)%00%(refname)%00%(objectname)%00%(upstream)%00%(symref)'
const FULL_OID = /^[0-9a-f]{40}$/
const HEADS = 'refs/heads/'
const REMOTES = 'refs/remotes/'

/** One `for-each-ref` record. */
export interface RefRecord {
  /** Whether HEAD points at this branch. */
  readonly head: boolean
  /** Full ref name. */
  readonly name: string
  /** Target commit id. */
  readonly oid: string
  /** Full upstream ref name, or empty. */
  readonly upstream: string
  /** Full symbolic-ref target, or empty. */
  readonly symref: string
}

/** Everything {@link resolveGraphReferences} reads. */
export interface ReferenceInputs {
  /** Branch and remote-tracking records. */
  readonly records: readonly RefRecord[]
  /** Configured remote names in Git's order. */
  readonly remotes: readonly string[]
  /** `branch.<name>.vscode-merge-base` value, or empty when unset. */
  readonly mergeBase: string
  /** Detached HEAD commit id, or null when HEAD is a branch or unborn. */
  readonly detachedHead: string | null
}

/** Graph references when the repository has none. */
export const NO_GRAPH_REFERENCES: GraphReferences = { current: null, remote: null, base: null }

/**
 * Parse `for-each-ref` output written with {@link REF_FORMAT}.
 * Malformed lines are skipped.
 * @param stdout - command output.
 * @returns records in Git's order.
 */
export function parseRefRecords(stdout: string): RefRecord[] {
  const records: RefRecord[] = []
  for (const line of stdout.split('\n')) {
    if (line === '') continue
    const fields = line.split('\0')
    if (fields.length < 5) continue
    const name = fields[1] ?? ''
    const oid = fields[2] ?? ''
    if (name === '' || !FULL_OID.test(oid)) continue
    records.push({
      head: (fields[0] ?? '').trim() === '*',
      name,
      oid,
      upstream: fields[3] ?? '',
      symref: fields[4] ?? '',
    })
  }
  return records
}

/**
 * Short display name of a branch or remote-tracking ref.
 * @param name - full ref name.
 * @returns name without `refs/heads/` or `refs/remotes/`.
 */
export function shortRefName(name: string): string {
  if (name.startsWith(HEADS)) return name.slice(HEADS.length)
  if (name.startsWith(REMOTES)) return name.slice(REMOTES.length)
  return name
}

/**
 * Turn a record into a graph reference.
 * @param record - ref record.
 * @returns graph reference.
 */
function toReference(record: RefRecord): GraphReference {
  return { id: record.name, name: shortRefName(record.name), revision: record.oid }
}

/**
 * Resolve the checked-out, upstream and base references.
 *
 * The base branch follows VS Code: a configured `vscode-merge-base` that names
 * a remote-tracking branch, otherwise the default branch of the default remote
 * (`origin`, or the first remote). It is dropped when it is the upstream.
 * @param inputs - records, remotes, configuration and detached HEAD.
 * @returns graph references.
 */
export function resolveGraphReferences(inputs: ReferenceInputs): GraphReferences {
  const byName = new Map(inputs.records.map((record) => [record.name, record]))
  const branch = inputs.records.find((record) => record.head && record.name.startsWith(HEADS))
  if (branch === undefined) {
    const oid = inputs.detachedHead
    if (oid === null || !FULL_OID.test(oid)) return NO_GRAPH_REFERENCES
    return { current: { id: oid, name: oid, revision: oid }, remote: null, base: null }
  }
  const upstream = branch.upstream === '' ? undefined : byName.get(branch.upstream)
  let base: RefRecord | undefined
  if (inputs.mergeBase !== '') base = byName.get(`${REMOTES}${inputs.mergeBase}`)
  if (base === undefined) {
    const remote = inputs.remotes.includes('origin') ? 'origin' : inputs.remotes[0]
    const pointer = remote === undefined ? undefined : byName.get(`${REMOTES}${remote}/HEAD`)
    const target = pointer === undefined || pointer.symref === '' ? '' : pointer.symref
    if (target.startsWith(REMOTES)) base = byName.get(target)
  }
  if (base !== undefined && base.name === branch.upstream) base = undefined
  return {
    current: toReference(branch),
    remote: upstream === undefined ? null : toReference(upstream),
    base: base === undefined ? null : toReference(base),
  }
}

/**
 * Read the graph references of a repository. A failed read only loses the
 * special colors, so it yields null references instead of failing the history.
 * @param root - repository root.
 * @returns graph references.
 */
export async function readGraphReferences(root: string): Promise<GraphReferences> {
  const [refs, remotes, head] = await Promise.all([
    runGit(root, ['for-each-ref', `--format=${REF_FORMAT}`, 'refs/heads', 'refs/remotes']),
    runGit(root, ['remote']),
    runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD']),
  ])
  if (!refs.ok) return NO_GRAPH_REFERENCES
  const records = parseRefRecords(refs.stdout)
  const branch = records.find((record) => record.head && record.name.startsWith(HEADS))
  let mergeBase = ''
  if (branch !== undefined) {
    const configured = await runGit(root, [
      'config',
      '--get',
      `branch.${shortRefName(branch.name)}.vscode-merge-base`,
    ])
    if (configured.ok) mergeBase = configured.stdout.trim()
  }
  return resolveGraphReferences({
    records,
    remotes: remotes.ok
      ? remotes.stdout
          .split('\n')
          .map((name) => name.trim())
          .filter((name) => name !== '')
      : [],
    mergeBase,
    detachedHead: branch === undefined && head.ok ? head.stdout.trim() : null,
  })
}
