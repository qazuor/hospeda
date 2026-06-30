/**
 * Utility functions for the Hospeda monorepo
 * @module utils
 */

export * from './string';
export * from './date';
export * from './object';
export * from './array';
export * from './validation';
export * from './currency';
export * from './sentry';
export * from './markdown-helpers';
export * from './tiptap-renderer';

// NOTE: `safe-fetch` and `safe-fetch-ip` are intentionally NOT re-exported from
// this barrel. They are server-only modules (they import `undici` and
// `node:dns/promises`), and undici evaluates `process.versions.node` at module
// top-level — which throws `ReferenceError: process is not defined` in a browser
// bundle. Re-exporting them here pulled undici into every client bundle that
// imports anything from `@repo/utils` (e.g. `formatMicroUsd`), breaking the admin
// app. Import them via the dedicated subpath instead: `@repo/utils/safe-fetch`.
