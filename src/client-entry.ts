/**
 * Build entry for the browser artifact.
 *
 * The loader expects one artifact per package, so this file is the only entry
 * of the esbuild bundle: everything the browser half exports is reachable from
 * here.
 */
export { apply, inject } from './client/plugin.ts'
