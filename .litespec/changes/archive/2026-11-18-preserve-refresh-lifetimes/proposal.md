# Preserve refreshes and watcher disposal across asynchronous work

## Why

A required post-operation status read is silently dropped when an older read is already in flight. Its stale snapshot can then win, leaving the panel inaccurate until another signal. On the Host, asynchronous watcher setup can finish after the panel cancels or the plugin unloads and recreate watchers outside their owning lifetime.

## What Changes

- Overlapping refresh requests share a serialized read cycle with a coalesced follow-up, so a completed write is followed by a fresh read rather than only the older snapshot.
- Cancelling a pending watch, replacing that panel's repository or disposing the registry invalidates obsolete setup; a disposed registry cannot be reopened.
- Existing refresh scopes, watch debounce, subscription expiry, busy indicators and error surfaces remain unchanged.

## Non-goals

- No new polling schedule, remote operations, graph layout or UI redesign.
- No general rewrite of every asynchronous hook, cross-window panel identity or Session-migration semantics.
- Test cleanup improvements are internal infrastructure and do not change plugin behavior.
