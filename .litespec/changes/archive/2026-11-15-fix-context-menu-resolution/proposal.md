# Resolve context-menu commands from the invoked target

## Why

The panel's right-click menus were advertised but unusable: the shared overlay
opened with no commands in it, so a right-click looked like nothing happened and
the panel appeared unresponsive. Every invocation — changed files, folders,
change group headers, commits, and the diff header — resolved to an empty
command list because the panel read the command source from the wrong level of
the target it had registered with the host's shared context-menu service. The
test suite did not catch this because its stand-in for that service made the
same wrong assumption, so the defect only appeared in a real page.

## What Changes

Invoking a menu on a listed object now shows that object's commands: opening a
diff, staging or unstaging, discarding, refreshing, and copying paths, commit
identifiers, and commit subjects, matching the equivalent inline control. A menu
invoked on a commit lists only its copy commands, and one invoked on a changed
file or folder lists only that object's commands. An invoked menu always carries
at least one command, so a menu never opens empty. Pointer and keyboard
invocation, positioning, dismissal, theme and language, and the inline-control
fallback are unchanged.

## Non-goals

- Adding new menu commands, shortcuts, or menu appearance changes.
- Changing inline controls, confirmations, or the Host Git RPC surface.
- Redesigning how the panel consumes the host's shared context-menu service.
