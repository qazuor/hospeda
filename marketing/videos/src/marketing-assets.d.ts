/**
 * JSON produced by the pipeline (event logs, character layer maps) lives in the external public dir
 * and is reached through the `@marketing-assets` webpack alias (remotion.config.ts). It is typed as
 * `unknown` so typecheck never depends on files outside the repo; each consumer narrows it.
 */
declare module '@marketing-assets/*.json' {
    const value: unknown;
    export default value;
}
