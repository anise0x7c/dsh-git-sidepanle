import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  type ArchitectureReport,
  type ArchitectureRule,
  CLIENT_ENTRY,
  HOST_ENTRY,
  validateArchitecture,
} from './support/architecture.ts'

const root = fileURLToPath(new URL('..', import.meta.url))

function check(files: Record<string, string>): ArchitectureReport {
  return validateArchitecture(new Map(Object.entries(files)))
}

function assertViolation(
  files: Record<string, string>,
  rule: ArchitectureRule,
  message: RegExp,
): void {
  const report = check(files)
  const matching = report.violations.filter((violation) => violation.rule === rule)
  assert.ok(
    matching.some((violation) => message.test(violation.message)),
    `expected ${rule} matching ${message}: ${JSON.stringify(report.violations, null, 2)}`,
  )
}

async function collectSources(
  directory: string,
  prefix: string,
  files: Map<string, string>,
): Promise<void> {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const virtual = `${prefix}${entry.name}`
    if (entry.isDirectory()) {
      await collectSources(path.join(directory, entry.name), `${virtual}/`, files)
    } else if (entry.name.endsWith('.ts')) {
      files.set(virtual, await readFile(path.join(directory, entry.name), 'utf8'))
    }
  }
}

/** A small valid tree: Host/Node, browser/React, pure client and erased types. */
function validTree(): Record<string, string> {
  return {
    [HOST_ENTRY]: `
      import { join } from 'node:path'
      import { read } from './host/read.ts'
      import type { Wire } from './shared/git.ts'
      export const inject = ['webServer']
      export function apply(): string { return read(join('a', 'b')) }
      export type Result = Wire
    `,
    'src/host/read.ts': `
      import type { Wire } from '../shared/git.ts'
      export function read(value: string): string { return value }
      export type Wired = Wire
    `,
    'src/host/context.ts': `
      export interface HostContext { readonly effect: (setup: () => void) => () => void }
    `,
    [CLIENT_ENTRY]: `
      import { createElement } from 'react'
      import './client/styles/graph.css'
      import { mount } from './client/plugin.ts'
      export const inject: unknown[] = []
      export function apply(): unknown { return createElement('div', null, mount()) }
    `,
    'src/client/plugin.ts': `
      import type { Wire } from '../shared/git.ts'
      import { PACKAGE_ID } from './constants.ts'
      import { format } from './git/format.ts'
      export function mount(): string { return PACKAGE_ID + format() }
      export type Wired = Wire
    `,
    'src/client/constants.ts': `
      import type { Wire } from '../shared/git.ts'
      export const PACKAGE_ID = 'pkg'
      export type Wired = Wire
    `,
    'src/client/git/format.ts': `
      import type { Entry } from '../types/domain.ts'
      export function format(entry?: Entry): string { return entry?.path ?? '' }
    `,
    'src/client/types/domain.ts': `export interface Entry { readonly path: string }`,
    'src/shared/git.ts': `export interface Wire { readonly ok: boolean }`,
  }
}

test('the real src tree satisfies the architecture rules', async () => {
  const files = new Map<string, string>()
  await collectSources(path.join(root, 'src'), 'src/', files)
  const report = validateArchitecture(files)
  assert.deepEqual(report.violations, [])
  assert.ok(report.modules.includes(HOST_ENTRY))
  assert.ok(report.modules.includes(CLIENT_ENTRY))
})

test('a valid tree permits erased type imports and the allowed externals', () => {
  assert.deepEqual(check(validTree()).violations, [])
})

test('a runtime cycle is reported with its complete path', () => {
  assertViolation(
    {
      [HOST_ENTRY]: `import { a } from './host/a.ts'\na()`,
      'src/host/a.ts': `import { b } from './b.ts'\nexport function a(): void { b() }`,
      'src/host/b.ts': `import { a } from './a.ts'\nexport function b(): void { a() }`,
    },
    'runtime-cycle',
    /src\/host\/a\.ts -> src\/host\/b\.ts -> src\/host\/a\.ts/,
  )
})

test('type-only imports do not create a runtime cycle', () => {
  const report = check({
    [HOST_ENTRY]: `import { start } from './host/a.ts'\nstart()`,
    'src/host/a.ts': `
      import type { B } from './b.ts'
      export function start(): void {}
      export interface A { readonly b?: B }
    `,
    'src/host/b.ts': `
      import type { A } from './a.ts'
      export interface B { readonly a?: A }
    `,
  })
  assert.deepEqual(report.violations, [])
})

test('imports across runtime halves are rejected even when type-only', () => {
  assertViolation(
    {
      [HOST_ENTRY]: `import { rpc } from './host/rpc.ts'\nrpc()`,
      'src/host/rpc.ts': `
        import { GitPanel } from '../client/panel/GitPanel.ts'
        export function rpc(): unknown { return GitPanel }
      `,
      [CLIENT_ENTRY]: `import { GitPanel } from './client/panel/GitPanel.ts'\nexport const panel = GitPanel`,
      'src/client/panel/GitPanel.ts': `export const GitPanel = 'panel'`,
    },
    'cross-runtime',
    /src\/host\/rpc\.ts -> src\/client\/panel\/GitPanel\.ts \(runtime import/,
  )
  assertViolation(
    {
      [HOST_ENTRY]: `
        import type { LocaleBinder } from './client/types/dsh.ts'
        export const bind: LocaleBinder | undefined = undefined
      `,
      'src/client/types/dsh.ts': `export interface LocaleBinder { readonly id: string }`,
    },
    'cross-runtime',
    /src\/host-entry\.ts -> src\/client\/types\/dsh\.ts \(type import/,
  )
})

test('shared wire modules stay type-only and are imported type-only', () => {
  assertViolation(
    {
      [HOST_ENTRY]: `
        import type { Wire } from './shared/git.ts'
        export const wire: Wire | undefined = undefined
      `,
      'src/shared/git.ts': `
        export interface Wire { readonly ok: boolean }
        export const WIRE = 1
      `,
    },
    'shared-runtime',
    /executable declaration 'WIRE'/,
  )
  assertViolation(
    {
      [HOST_ENTRY]: `export const host = 1`,
      'src/shared/git.ts': `
        import { join } from 'node:path'
        export interface Wire { readonly path: string }
        export const wirePath = (value: string): string => join(value)
      `,
    },
    'shared-runtime',
    /runtime dependency on 'node:path'/,
  )
  assertViolation(
    {
      [HOST_ENTRY]: `
        import { type Wire } from './shared/git.ts'
        export const wire: Wire | undefined = undefined
      `,
      'src/shared/git.ts': `export interface Wire { readonly ok: boolean }`,
    },
    'shared-runtime',
    /imports type-only shared module src\/shared\/git\.ts as a runtime value/,
  )
  assertViolation(
    {
      [HOST_ENTRY]: `
        import { WIRE } from './shared/git.ts'
        export const value = WIRE
      `,
      'src/shared/git.ts': `
        export interface Wire { readonly ok: boolean }
        export const WIRE = 1
      `,
    },
    'shared-runtime',
    /imports type-only shared module src\/shared\/git\.ts as a runtime value/,
  )
})

test('pure client modules may only reach other pure modules at runtime', () => {
  assertViolation(
    {
      [CLIENT_ENTRY]: `import { el } from './client/constants.ts'\nexport const node = el`,
      'src/client/constants.ts': `
        import { createElement } from 'react'
        export const el = createElement('div')
      `,
    },
    'pure-dependency',
    /src\/client\/constants\.ts.*runtime dependency on 'react'/,
  )
  assertViolation(
    {
      [CLIENT_ENTRY]: `import { mount } from './client/plugin.ts'\nmount()`,
      'src/client/plugin.ts': `
        import { format } from './git/format.ts'
        export function mount(): string { return format() }
      `,
      'src/client/git/format.ts': `
        import { PANEL } from '../panel/GitPanel.ts'
        export function format(): string { return PANEL }
      `,
      'src/client/panel/GitPanel.ts': `export const PANEL = 'panel'`,
    },
    'pure-dependency',
    /src\/client\/git\/format\.ts.*panel\/GitPanel\.ts/,
  )
})

test('whole-clause type imports are erased while inline type specifiers load the module', () => {
  const erased: Record<string, string> = {
    [CLIENT_ENTRY]: `import { el } from './client/constants.ts'\nexport const node = el`,
    'src/client/constants.ts': `
      import type { PanelProps } from './panel/GitPanel.ts'
      export const el: PanelProps | undefined = undefined
    `,
    'src/client/panel/GitPanel.ts': `export interface PanelProps { readonly id: string }`,
  }
  assert.deepEqual(check(erased).violations, [])

  const inline: Record<string, string> = {
    [CLIENT_ENTRY]: `import { el } from './client/constants.ts'\nexport const node = el`,
    'src/client/constants.ts': `
      import { type PanelProps } from './panel/GitPanel.ts'
      export const el: PanelProps | undefined = undefined
    `,
    'src/client/panel/GitPanel.ts': `export interface PanelProps { readonly id: string }`,
  }
  assertViolation(inline, 'pure-dependency', /src\/client\/constants\.ts.*panel\/GitPanel\.ts/)

  const exported: Record<string, string> = {
    [CLIENT_ENTRY]: `import './client/constants.ts'\nexport const node = 1`,
    'src/client/constants.ts': `export { type PanelProps } from './panel/GitPanel.ts'`,
    'src/client/panel/GitPanel.ts': `export interface PanelProps { readonly id: string }`,
  }
  assertViolation(exported, 'pure-dependency', /src\/client\/constants\.ts.*panel\/GitPanel\.ts/)

  const mixed: Record<string, string> = {
    [CLIENT_ENTRY]: `
      import { PANEL } from './client/panel/GitPanel.ts'
      import { el } from './client/constants.ts'
      export const node = PANEL + el
    `,
    'src/client/constants.ts': `
      import { type PanelProps, PANEL } from './panel/GitPanel.ts'
      export const el: PanelProps | undefined = PANEL
    `,
    'src/client/panel/GitPanel.ts': `
      export interface PanelProps { readonly id: string }
      export const PANEL = 'panel'
    `,
  }
  assertViolation(mixed, 'pure-dependency', /src\/client\/constants\.ts.*panel\/GitPanel\.ts/)
})

test('side-effect imports are runtime edges', () => {
  assertViolation(
    {
      [HOST_ENTRY]: `import './host/a.ts'\nexport const entry = 1`,
      'src/host/a.ts': `import './b.ts'\nexport function a(): void {}`,
      'src/host/b.ts': `import './a.ts'\nexport function b(): void {}`,
    },
    'runtime-cycle',
    /src\/host\/a\.ts -> src\/host\/b\.ts -> src\/host\/a\.ts/,
  )
})

test('literal dynamic imports and require calls join the runtime graph', () => {
  assertViolation(
    {
      [HOST_ENTRY]: `import { a } from './host/a.ts'\na()`,
      'src/host/a.ts': `
        export async function a(): Promise<void> { await import('./b.ts') }
      `,
      'src/host/b.ts': `import { a } from './a.ts'\nexport function b(): void { a() }`,
    },
    'runtime-cycle',
    /src\/host\/a\.ts -> src\/host\/b\.ts -> src\/host\/a\.ts/,
  )
  assertViolation(
    {
      [HOST_ENTRY]: `const a = require('./host/a.ts')\nexport const entry = a`,
      'src/host/a.ts': `import { entry } from '../host-entry.ts'\nexport const a = entry`,
    },
    'runtime-cycle',
    /src\/host-entry\.ts -> src\/host\/a\.ts -> src\/host-entry\.ts/,
  )
})

test('non-literal dynamic imports and require calls are rejected', () => {
  const report = check({
    [HOST_ENTRY]: `
      const target = './host/a.ts'
      void import(target)
      require(target)
      export const entry = 1
    `,
    'src/host/a.ts': `export const a = 1`,
  })
  const rejected = report.violations.filter((violation) => violation.rule === 'dynamic-import')
  assert.equal(rejected.length, 2)
  assert.ok(rejected.some((violation) => /non-literal dynamic import/.test(violation.message)))
  assert.ok(rejected.some((violation) => /non-literal require call/.test(violation.message)))
})

test('orphaned executable modules are rejected while type-only modules are exempt', () => {
  const report = check({
    [HOST_ENTRY]: `export const host = 1`,
    [CLIENT_ENTRY]: `export const client = 1`,
    'src/client/panel/orphan.ts': `export const orphan = 1`,
    'src/client/types/local.ts': `export interface Local { readonly id: string }`,
  })
  const orphans = report.violations.filter((violation) => violation.rule === 'orphan-module')
  assert.ok(orphans.some((violation) => /src\/client\/panel\/orphan\.ts/.test(violation.message)))
  assert.ok(!orphans.some((violation) => /src\/client\/types\/local\.ts/.test(violation.message)))
})

test('runtime externals stay within the half allowlists', () => {
  assertViolation(
    {
      [HOST_ENTRY]: `
        import { createElement } from 'react'
        export const node = createElement('div')
      `,
    },
    'external-runtime',
    /'react' is not allowed in the host half/,
  )
  assertViolation(
    {
      [CLIENT_ENTRY]: `
        import { readFile } from 'node:fs/promises'
        export const read = readFile
      `,
    },
    'external-runtime',
    /'node:fs\/promises' is not allowed in the client half/,
  )
  assertViolation(
    {
      [HOST_ENTRY]: `import 'node:fake'\nexport const value = 1`,
    },
    'external-runtime',
    /'node:fake' is not allowed in the host half/,
  )
})

test('only the two guarded host-primitive wrappers may request the shared primitives', () => {
  assert.deepEqual(
    check({
      [HOST_ENTRY]: `export const inject = []\nexport function apply(): void {}`,
      [CLIENT_ENTRY]: `
        import { createElement } from 'react'
        import { HostFileIcon } from './client/host-file-icon.ts'
        export function apply(): unknown { return createElement('div', null, HostFileIcon()) }
      `,
      'src/client/host-file-icon.ts': `
        export function HostFileIcon(): unknown {
          return require('@deepseek-ai/dsh-client-ui-primitives')
        }
      `,
    }).violations,
    [],
  )
  assert.deepEqual(
    check({
      [HOST_ENTRY]: `export const inject = []\nexport function apply(): void {}`,
      [CLIENT_ENTRY]: `
        import { createElement } from 'react'
        import { ToastHost } from './client/toast/ToastHost.ts'
        export function apply(): unknown { return createElement('div', null, ToastHost()) }
      `,
      'src/client/toast/ToastHost.ts': `
        export function ToastHost(): unknown {
          return require('@deepseek-ai/dsh-client-ui-primitives')
        }
      `,
    }).violations,
    [],
  )
  assertViolation(
    {
      [HOST_ENTRY]: `export const inject = []\nexport function apply(): void {}`,
      [CLIENT_ENTRY]: `import { icon } from './client/icons.ts'\nexport function apply(): unknown { return icon() }`,
      'src/client/icons.ts': `
        export function icon(): unknown {
          return require('@deepseek-ai/dsh-client-ui-primitives')
        }
      `,
    },
    'external-runtime',
    /'@deepseek-ai\/dsh-client-ui-primitives' is not allowed in the client half/,
  )
  assertViolation(
    {
      [HOST_ENTRY]: `export const inject = []\nexport function apply(): void {}`,
      [CLIENT_ENTRY]: `
        import { ToastHost } from './client/toast/ToastHost.ts'
        export function apply(): unknown { return ToastHost() }
      `,
      'src/client/toast/ToastHost.ts': `
        export function ToastHost(): unknown {
          return require('@deepseek-ai/dsh-client-ui-sidebar-files')
        }
      `,
    },
    'external-runtime',
    /'@deepseek-ai\/dsh-client-ui-sidebar-files' is not allowed in the client half/,
  )
})
