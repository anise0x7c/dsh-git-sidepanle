/** Compile-only assertions: included by tsc, never executed by the test runner. */
import type { RpcCall, StatusResult } from '../../src/client/types/domain.ts'
import type { GitGraphRequest, HistoryResult } from '../../src/shared/git.ts'

export function assertRpcTypes(call: RpcCall, status: StatusResult): void {
  const history: Promise<HistoryResult> = call('history')
  void history
  const earlierHistory: Promise<HistoryResult> = call('history', { offset: 60 })
  void earlierHistory
  // @ts-expect-error The history offset is a commit count, not text.
  void call('history', { offset: '60' })
  void call('stage', { paths: ['src/example.ts'] })
  void call('commit', { message: 'Keep the wire contract checked' })
  void call('diff', { path: 'src/example.ts', staged: true })
  void call('remotes')
  void call('fetch')
  void call('pull')
  void call('pull', { rebase: true })
  void call('push')
  void call('publish')
  void call('publish', { remote: 'origin' })
  void call('sync')
  void call('add-remote', { name: 'origin', url: 'https://example.test/repo.git' })
  void call('remove-remote', { name: 'origin' })
  void call('checkout-remote', { remote: 'origin', branch: 'main' })

  // @ts-expect-error Unknown operation names must not reach the wire.
  void call('rebase')
  // @ts-expect-error Each operation accepts only its own argument shape.
  void call('commit', { paths: ['src/example.ts'] })
  // @ts-expect-error Repository-relative file paths are strings.
  void call('stage', { paths: [42] })
  // @ts-expect-error Mutating operations require their arguments.
  void call('stage')
  // @ts-expect-error A diff always addresses a repository-relative path.
  void call('diff')

  if (status.repo === null) {
    const cwd: string = status.cwd
    void cwd
  } else {
    const root: string = status.repo.root
    const cwd: string = status.repo.cwd
    void root
    void cwd
  }

  const request: GitGraphRequest = { sessionId: 'session-1', op: 'status' }
  void request
  // @ts-expect-error Session identities remain strings even for payload-free operations.
  const invalidSession: GitGraphRequest = { sessionId: 42, op: 'status' }
  // @ts-expect-error A stage request cannot omit the paths field.
  const invalidStage: GitGraphRequest = { sessionId: 'session-1', op: 'stage' }
  void invalidSession
  void invalidStage
}
