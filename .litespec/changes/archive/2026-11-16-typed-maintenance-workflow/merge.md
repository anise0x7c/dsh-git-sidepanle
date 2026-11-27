# Merge Summary: typed-maintenance-workflow

- Date: 2026-11-16
- Change: typed-maintenance-workflow

## Notes

Completed behavior-preserving TypeScript migration of Host/browser/scripts/tests; pinned pnpm 11.28.5 and Biome 2.6.7, committed lock and generated dual JavaScript entries/maps, added strict type/style/read-only artifact gate plus Node22/24 CI. Removed duplicated registrations/wiring and corrected effect-owned style lifecycle. All 208 original tests retained; 251 tests in 41 suites pass on Node24.21, compile-only RPC contracts pass, Biome has no warnings, standalone Host artifact loads without dev dependencies, real DSH0.2.2-rc.3 menu registry resolves 5targets/14commands. Negative frozen-lock/stale-artifact/dependency-import probes and isolated dual watch smoke pass. Independent deepseek-official/deepseek-flash review found no blockers. Live GUI serves equivalent client code and both slots are active; visual/click-through not available, Host not restarted. No profile changes, release or commit.

## Capabilities

| Capability | Added | Modified | Removed | Spec |
| --- | --- | --- | --- | --- |
| development-workflow | 4 | 0 | 0 | created |

### development-workflow

- Added: 4, Modified: 0, Removed: 0
- Spec: created
- Requirements added: Reproducible contributor installation, Automated maintenance gate, Compiler-free plugin installation, Continuous integration parity

