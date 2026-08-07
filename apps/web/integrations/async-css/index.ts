/**
 * @file index.ts
 * @description Module barrel for the async-CSS rewriter. Exposes
 * `rewriteAsyncStylesheets` (and its supporting constants) for use by
 * `src/middleware.ts`.
 *
 * @see rewrite-async-stylesheets.ts for the full rationale.
 */

export {
    ASYNC_CSS_ACTIVATION_SCRIPT_CONTENT,
    BLOCKING_STYLESHEET_ALLOWLIST_PATTERNS,
    isBlockingStylesheetName,
    rewriteAsyncStylesheets
} from './rewrite-async-stylesheets';
