/**
 * Utility functions for the Hospeda monorepo
 * @module utils
 */

export * from './array';
export * from './currency';
export * from './date';
export * from './markdown-helpers';
export * from './object';
export * from './sentry';
export * from './string';
export * from './tiptap-renderer';
export * from './validation';

// NOTE: `safe-fetch` and `safe-fetch-ip` are intentionally NOT re-exported from
// this barrel. They are server-only modules (they import `undici` and
// `node:dns/promises`), and undici evaluates `process.versions.node` at module
// top-level — which throws `ReferenceError: process is not defined` in a browser
// bundle. Re-exporting them here pulled undici into every client bundle that
// imports anything from `@repo/utils` (e.g. `formatMicroUsd`), breaking the admin
// app. Import them via the dedicated subpath instead: `@repo/utils/safe-fetch`.
