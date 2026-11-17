# Keep file operations within literal repository paths

## Why

A repository-relative path currently still carries Git pattern semantics: selecting a filename containing `*`, `?`, brackets or pathspec magic can affect other files. Direct filesystem previews and untracked discards can also follow linked parents outside the repository. The HTTP trust fence does not replace validation of file-action scope.

## What Changes

- Git-backed file actions interpret accepted paths literally, including filenames containing pattern characters; valid double-dot-prefixed names are no longer confused with parent traversal.
- Untracked previews and deletion recheck Git's current non-ignored untracked classification; a stale or incorrect flag is refused with localized feedback. Untracked previews refuse symbolic links and non-regular files. Direct previews and deletion refuse linked parent directories; deleting an untracked symbolic link itself still removes only that link.
- Preserve the existing routes, request/result envelopes, confirmation flow and normal Git behavior.

## Non-goals

- No new UI, dependencies, installation changes, version bump or automatic commits.
- No attempt to sandbox Git hooks, user Git configuration or a malicious local process concurrently renaming ancestor directories. The repository and local account remain trusted; these checks constrain browser-supplied paths, not operating-system capabilities.
- The behavior-neutral module extraction is recorded in the maintenance plan, not modeled as new user behavior.
