/** Categories for grouping commands in the interactive menu */
export type CommandCategory =
    | 'development'
    | 'database'
    | 'testing'
    | 'code-quality'
    | 'build'
    | 'environment'
    | 'documentation'
    | 'infrastructure'
    | 'package-tools';

/** How the command behaves when running */
export type CommandMode =
    | 'one-shot' // Runs and exits (build, test, lint, etc.)
    | 'long-running' // Runs until Ctrl+C (dev servers, db:studio, db:logs)
    | 'interactive'; // Has its own interactive UI (seed, db:studio)

/** How the command should be executed (discriminated union) */
export type CommandExecution =
    | { readonly type: 'pnpm-root'; readonly script: string }
    | { readonly type: 'pnpm-filter'; readonly filter: string; readonly script: string }
    | { readonly type: 'shell'; readonly command: string };

/** Base fields shared by all CLI commands */
interface CliCommandBase {
    /** Unique identifier shown in the menu (e.g., "db:start", "api:test:e2e") */
    readonly id: string;
    /** Human-readable description (max 60 chars for alignment) */
    readonly description: string;
    /** Category for grouping in menu */
    readonly category: CommandCategory;
    /** How to execute this command */
    readonly execution: CommandExecution;
    /** Source package name (e.g., "root", "@repo/db", "hospeda-api") */
    readonly source: string;
    /** How the command behaves when running */
    readonly mode: CommandMode;
    /** Whether this appears in the curated interactive menu (vs only in search/direct) */
    readonly curated: boolean;
    /** Optional hint about accepted arguments */
    readonly argHint?: string;
}

/** A CLI command entry in the registry or auto-discovered */
export type CliCommand = CliCommandBase &
    (
        | { readonly dangerous?: false; readonly dangerMessage?: never }
        | { readonly dangerous: true; readonly dangerMessage: string }
    );

/** Schema version for CLI history */
export interface CliHistory {
    /** Schema version for future compatibility */
    readonly version: 1;
    /** Ordered list of recent command entries */
    readonly entries: readonly CliHistoryEntry[];
}

/** A single history entry tracking command usage */
export interface CliHistoryEntry {
    /** Command ID */
    readonly id: string;
    /** ISO 8601 timestamp of last execution */
    readonly lastRun: string;
    /** Number of times this command has been run */
    readonly runCount: number;
}
