/**
 * Pure architecture checks over a virtual `src` file map.
 *
 * The checker parses every TypeScript module with the project's own TypeScript
 * compiler. Static imports, re-exports and literal dynamic `import()`/`require`
 * calls form the runtime graph. Under `verbatimModuleSyntax`, a whole-clause
 * `import type`/`export type` is erased, while an inline `{ type X }` specifier
 * still emits an empty import/re-export and therefore keeps the runtime module
 * edge. The real file system is read by the caller, so the rules stay
 * deterministic and directly testable.
 *
 * The rules mirror the documented module boundaries: one runtime cycle-free
 * graph per distribution entry, isolated Host/browser halves, type-only shared
 * wire declarations, a small pure client zone and no unreachable executable
 * modules.
 */

import { isBuiltin } from 'node:module'
import path from 'node:path'
import * as ts from 'typescript'

/** Virtual path of the distribution Host entry. */
export const HOST_ENTRY = 'src/host-entry.ts'
/** Virtual path of the distribution browser entry. */
export const CLIENT_ENTRY = 'src/client-entry.ts'
/**
 * The bundle's one non-React runtime request, resolved from the host's frozen
 * module table instead of being bundled.
 */
const HOST_FILE_TYPE_ICON_REQUEST = '@deepseek-ai/dsh-client-ui-primitives'
/** The only client module allowed to reach that host entry. */
const HOST_FILE_TYPE_ICON_MODULE = 'src/client/host-file-icon.ts'

/** Architecture rule a violation belongs to. */
export type ArchitectureRule =
  | 'cross-runtime'
  | 'dynamic-import'
  | 'external-runtime'
  | 'orphan-module'
  | 'pure-dependency'
  | 'runtime-cycle'
  | 'shared-runtime'

/** One rejected source dependency or module. */
export interface ArchitectureViolation {
  /** Rule that rejected the source. */
  readonly rule: ArchitectureRule
  /** Human-readable diagnostic naming the offending modules. */
  readonly message: string
}

/** Result of checking one virtual source tree. */
export interface ArchitectureReport {
  /** Rejected dependencies and modules. Empty when the tree is valid. */
  readonly violations: readonly ArchitectureViolation[]
  /** Module paths considered by the checker, sorted. */
  readonly modules: readonly string[]
}

type Half = 'client' | 'host' | 'other' | 'shared'
type DependencyKind = 'runtime' | 'type'

interface ParsedDependency {
  readonly specifier: string
  readonly kind: DependencyKind
  readonly line: number
}

interface InvalidDynamicImport {
  readonly expression: string
  readonly line: number
}

interface ParsedModule {
  readonly dependencies: readonly ParsedDependency[]
  readonly executable: readonly string[]
  readonly invalidImports: readonly InvalidDynamicImport[]
}

interface ModuleDependency extends ParsedDependency {
  readonly target?: string
  readonly external: boolean
  readonly resource: boolean
}

interface ModuleRecord {
  readonly path: string
  readonly half: Half
  readonly dependencies: readonly ModuleDependency[]
  readonly runtimeTargets: readonly string[]
  readonly executable: readonly string[]
  readonly hasRuntimeCode: boolean
}

/**
 * Check a virtual source tree against the architecture rules.
 * @param files - virtual path (`src/...`, forward slashes) to TypeScript source.
 * @returns every violation and the modules the checker considered.
 */
export function validateArchitecture(files: ReadonlyMap<string, string>): ArchitectureReport {
  const sources = new Map<string, string>()
  for (const [file, source] of files) {
    const normalized = normalizePath(file)
    if (normalized.endsWith('.ts') && !normalized.endsWith('.d.ts')) {
      sources.set(normalized, source)
    }
  }

  const modulePaths = new Set(sources.keys())
  const records = new Map<string, ModuleRecord>()
  const violations: ArchitectureViolation[] = []
  const sharedModules = new Set([...modulePaths].filter((file) => halfOf(file) === 'shared'))

  for (const file of [...sources.keys()].sort()) {
    const parsed = parseModule(sources.get(file) ?? '')
    for (const invalid of parsed.invalidImports) {
      violations.push({
        rule: 'dynamic-import',
        message: `${file}:${invalid.line} has a non-literal ${invalid.expression} that cannot be checked`,
      })
    }
    const dependencies = parsed.dependencies.map((dependency) => ({
      ...dependency,
      ...resolveDependency(file, dependency.specifier, modulePaths),
    }))
    records.set(file, {
      path: file,
      half: halfOf(file),
      dependencies,
      runtimeTargets: [
        ...new Set(
          dependencies
            .filter((dependency) => dependency.kind === 'runtime' && dependency.target)
            .map((dependency) => dependency.target as string),
        ),
      ],
      executable: parsed.executable,
      hasRuntimeCode:
        parsed.executable.length > 0 ||
        dependencies.some((dependency) => dependency.kind === 'runtime'),
    })
  }

  for (const record of records.values()) {
    violations.push(...checkDependencies(record, records, sharedModules))
  }
  violations.push(...checkCycles(records))
  violations.push(...checkOrphans(records))

  return {
    violations: dedupe(
      violations.sort((left, right) =>
        left.rule === right.rule
          ? left.message.localeCompare(right.message)
          : left.rule.localeCompare(right.rule),
      ),
    ),
    modules: [...modulePaths].sort(),
  }
}

function normalizePath(file: string): string {
  const unix = file.replaceAll('\\', '/')
  return path.posix.normalize(unix.startsWith('./') ? unix.slice(2) : unix)
}

function halfOf(file: string): Half {
  if (file === HOST_ENTRY || file.startsWith('src/host/')) return 'host'
  if (file === CLIENT_ENTRY || file.startsWith('src/client/')) return 'client'
  if (file.startsWith('src/shared/')) return 'shared'
  return 'other'
}

/**
 * Designated pure client modules. Their runtime imports may only reach another
 * pure module; erased type imports and declarations stay unrestricted.
 */
function isPureClientModule(file: string): boolean {
  return (
    file.startsWith('src/client/git/') ||
    file.startsWith('src/client/locale/') ||
    file === 'src/client/constants.ts' ||
    file === 'src/client/panel/change-groups.ts' ||
    file === 'src/client/panel/split.ts' ||
    file === 'src/client/panel/scroll.ts'
  )
}

function resolveDependency(
  from: string,
  specifier: string,
  modules: ReadonlySet<string>,
): Pick<ModuleDependency, 'resource' | 'target' | 'external'> {
  if (!specifier.startsWith('.')) {
    return { external: true, resource: false }
  }
  if (specifier.endsWith('.css')) {
    return { external: false, resource: true }
  }
  const base = path.posix.join(path.posix.dirname(from), specifier)
  for (const candidate of [base, `${base}.ts`, `${base}/index.ts`]) {
    if (modules.has(candidate)) return { external: false, resource: false, target: candidate }
  }
  return { external: false, resource: false }
}

function parseModule(source: string): ParsedModule {
  const file = ts.createSourceFile(
    'module.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const dependencies: ParsedDependency[] = []
  const invalidImports: InvalidDynamicImport[] = []
  const executable: string[] = []

  for (const statement of file.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)) {
      dependencies.push({
        specifier: statement.moduleSpecifier.text,
        kind: importKind(statement),
        line: lineOf(file, statement),
      })
    } else if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier !== undefined &&
      ts.isStringLiteralLike(statement.moduleSpecifier)
    ) {
      dependencies.push({
        specifier: statement.moduleSpecifier.text,
        kind: exportKind(statement),
        line: lineOf(file, statement),
      })
    } else if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      ts.isStringLiteralLike(statement.moduleReference.expression)
    ) {
      dependencies.push({
        specifier: statement.moduleReference.expression.text,
        kind: statement.isTypeOnly ? 'type' : 'runtime',
        line: lineOf(file, statement),
      })
    } else if (!isErasedDeclaration(statement)) {
      executable.push(statementName(statement))
    }
  }

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const imported = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const required = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if (imported || required) {
        const argument = node.arguments[0]
        if (argument !== undefined && ts.isStringLiteralLike(argument)) {
          dependencies.push({
            specifier: argument.text,
            kind: 'runtime',
            line: lineOf(file, node),
          })
        } else {
          invalidImports.push({
            expression: imported ? 'dynamic import' : 'require call',
            line: lineOf(file, node),
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)

  return { dependencies, executable, invalidImports }
}

function importKind(node: ts.ImportDeclaration): DependencyKind {
  return node.importClause?.isTypeOnly === true ? 'type' : 'runtime'
}

function exportKind(node: ts.ExportDeclaration): DependencyKind {
  return node.isTypeOnly ? 'type' : 'runtime'
}

function isErasedDeclaration(node: ts.Statement): boolean {
  if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) return true
  if (ts.isEmptyStatement(node)) return true
  if (ts.isImportEqualsDeclaration(node)) return node.isTypeOnly
  if (ts.isExportDeclaration(node)) {
    return node.moduleSpecifier === undefined || exportKind(node) === 'type'
  }
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined
  return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword) ?? false
}

function statementName(node: ts.Statement): string {
  if (ts.isVariableStatement(node)) {
    const first = node.declarationList.declarations[0]
    if (first !== undefined && ts.isIdentifier(first.name)) return first.name.text
  }
  const name = (node as unknown as { readonly name?: ts.DeclarationName }).name
  if (name !== undefined && ts.isIdentifier(name)) return name.text
  return ts.SyntaxKind[node.kind]
}

function lineOf(file: ts.SourceFile, node: ts.Node): number {
  return file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1
}

function checkDependencies(
  record: ModuleRecord,
  records: ReadonlyMap<string, ModuleRecord>,
  sharedModules: ReadonlySet<string>,
): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = []
  for (const dependency of record.dependencies) {
    const source = `${record.path}:${dependency.line}`
    if (dependency.target !== undefined) {
      const target = records.get(dependency.target)
      if (
        target !== undefined &&
        ((record.half === 'host' && target.half === 'client') ||
          (record.half === 'client' && target.half === 'host'))
      ) {
        violations.push({
          rule: 'cross-runtime',
          message: `${source} imports across runtime halves: ${record.path} -> ${target.path} (${dependency.kind} import of '${dependency.specifier}')`,
        })
      }
      if (dependency.kind === 'runtime' && sharedModules.has(dependency.target)) {
        violations.push({
          rule: 'shared-runtime',
          message: `${source} imports type-only shared module ${dependency.target} as a runtime value`,
        })
      }
    }

    if (record.half === 'shared' && dependency.kind === 'runtime') {
      violations.push({
        rule: 'shared-runtime',
        message: `${source} type-only shared module has a runtime dependency on '${dependency.specifier}'`,
      })
    }

    if (dependency.kind !== 'runtime') continue

    if (isPureClientModule(record.path)) {
      const target = dependency.target
      if (target === undefined || !isPureClientModule(target)) {
        violations.push({
          rule: 'pure-dependency',
          message: `${source} pure client module ${record.path} has a runtime dependency on ${target ?? `'${dependency.specifier}'`}`,
        })
      }
    }

    if (record.half === 'host' || record.half === 'client') {
      const message = externalDiagnostic(record.half, dependency, record.path)
      if (message !== undefined) violations.push({ rule: 'external-runtime', message })
    }
  }

  if (record.half === 'shared') {
    for (const name of record.executable) {
      violations.push({
        rule: 'shared-runtime',
        message: `${record.path} type-only shared module has executable declaration '${name}'`,
      })
    }
  }
  return violations
}

function externalDiagnostic(
  half: Half,
  dependency: ModuleDependency,
  source: string,
): string | undefined {
  if (dependency.resource) {
    return half === 'client'
      ? undefined
      : `external runtime import '${dependency.specifier}' is not allowed in the Host half`
  }
  if (!dependency.external) return undefined
  if (half === 'host' && isBuiltin(dependency.specifier)) return undefined
  if (half === 'client' && dependency.specifier === 'react') return undefined
  if (
    half === 'client' &&
    source === HOST_FILE_TYPE_ICON_MODULE &&
    dependency.specifier === HOST_FILE_TYPE_ICON_REQUEST
  ) {
    return undefined
  }
  return `external runtime import '${dependency.specifier}' is not allowed in the ${half} half`
}

function checkCycles(records: ReadonlyMap<string, ModuleRecord>): ArchitectureViolation[] {
  const violations: ArchitectureViolation[] = []
  const state = new Map<string, 'active' | 'done'>()
  const stack: string[] = []

  const visit = (file: string): void => {
    state.set(file, 'active')
    stack.push(file)
    for (const target of records.get(file)?.runtimeTargets ?? []) {
      if (state.get(target) === 'active') {
        const cycle = [...stack.slice(stack.indexOf(target)), target]
        violations.push({
          rule: 'runtime-cycle',
          message: `runtime cycle: ${cycle.join(' -> ')}`,
        })
      } else if (state.get(target) !== 'done') {
        visit(target)
      }
    }
    stack.pop()
    state.set(file, 'done')
  }

  for (const file of [...records.keys()].sort()) {
    if (state.get(file) === undefined) visit(file)
  }
  return violations
}

function checkOrphans(records: ReadonlyMap<string, ModuleRecord>): ArchitectureViolation[] {
  const reachable = new Set<string>()
  const queue = [HOST_ENTRY, CLIENT_ENTRY].filter((entry) => records.has(entry))
  while (queue.length > 0) {
    const file = queue.pop() as string
    if (reachable.has(file)) continue
    reachable.add(file)
    for (const target of records.get(file)?.runtimeTargets ?? []) {
      if (!reachable.has(target)) queue.push(target)
    }
  }

  return [...records.values()]
    .filter((record) => record.hasRuntimeCode && !reachable.has(record.path))
    .map((record) => ({
      rule: 'orphan-module' as const,
      message: `executable module ${record.path} is not reachable from ${HOST_ENTRY} or ${CLIENT_ENTRY}`,
    }))
}

function dedupe(violations: ArchitectureViolation[]): ArchitectureViolation[] {
  const seen = new Set<string>()
  return violations.filter((violation) => {
    const key = `${violation.rule}\n${violation.message}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
