/**
 * @file setup.ts
 * @description Idempotent Umami dashboards-as-code setup (HOS-2119, AC-6).
 *
 * Upserts every saved report first, then the boards that reference them by id.
 * Re-running changes nothing (second run reports everything as unchanged).
 *
 * Usage: `pnpm umami:setup [--dry-run]`
 *
 * Environment variables:
 * - `HOSPEDA_UMAMI_URL` (registered): base URL of the Umami instance.
 * - `HOSPEDA_UMAMI_WEBSITE_ID_WEB` (registered): website the reports read.
 * - `UMAMI_SETUP_API_KEY`: READ-WRITE API key. Falls back to
 *   `HOSPEDA_UMAMI_API_KEY`, which is view-only by registry contract and will
 *   be rejected on writes.
 * - `UMAMI_SETUP_USERNAME` + `UMAMI_SETUP_PASSWORD`: alternative to the key
 *   (logged in with `POST /api/auth/login`).
 *
 * The `UMAMI_SETUP_*` names are script-only (like the old `POSTHOG_*` ones) and
 * are intentionally not part of the app registry.
 */

import { fileURLToPath } from 'node:url';
import { buildBoardDefinitions } from './boards.js';
import {
    loginUmami,
    UmamiApiError,
    type UmamiClientConfig,
    type UpsertResult,
    upsertBoard,
    upsertReport
} from './client.js';
import { buildReportDefinitions } from './definitions.js';

/** Prefix of the id used for a report a dry-run would create (it does not exist yet). */
export const DRY_RUN_PLACEHOLDER_PREFIX = 'dry-run-placeholder:';

/** Counts of one resource kind. */
export interface ActionCounts {
    readonly created: number;
    readonly updated: number;
    readonly unchanged: number;
}

/** Outcome of {@link runSetup}. */
export interface SetupOutcome {
    /** 0 on success, 1 on any error. */
    readonly exitCode: 0 | 1;
    readonly reports: ActionCounts;
    readonly boards: ActionCounts;
}

/** Input of {@link runSetup}. */
export interface RunSetupInput {
    readonly baseUrl: string;
    readonly websiteId: string;
    /** Bearer credential, or username and password to log in with. */
    readonly credentials:
        | { readonly kind: 'token'; readonly token: string }
        | { readonly kind: 'login'; readonly username: string; readonly password: string };
    readonly dryRun: boolean;
    readonly fetchImpl?: typeof fetch;
    /** Stdout sink. Defaults to `console.log`. */
    readonly log?: (line: string) => void;
    /** Stderr sink. Defaults to `console.error`. */
    readonly error?: (line: string) => void;
}

interface MutableCounts {
    created: number;
    updated: number;
    unchanged: number;
}

function describeError(error: unknown, secrets: readonly string[]): string {
    let text =
        error instanceof UmamiApiError
            ? `${error.message} [${error.kind}]`
            : error instanceof Error
              ? error.message
              : String(error);
    for (const secret of secrets) {
        if (secret.length > 0) text = text.split(secret).join('[redacted]');
    }
    return text;
}

function formatRow(input: { readonly label: string; readonly counts: ActionCounts }): string {
    const { label, counts } = input;
    return `${label.padEnd(10)}${String(counts.created).padStart(8)}${String(counts.updated).padStart(8)}${String(counts.unchanged).padStart(11)}`;
}

/**
 * Runs the setup: reports first, then boards. Never throws; failures are
 * printed (token-free) and reflected in `exitCode`.
 *
 * @param input - Connection, credentials and mode
 * @returns Exit code and per-resource counts
 *
 * @example
 * ```ts
 * const { exitCode } = await runSetup({ baseUrl, websiteId, credentials, dryRun: true });
 * ```
 */
export async function runSetup(input: RunSetupInput): Promise<SetupOutcome> {
    const log = input.log ?? ((line: string) => console.log(line));
    const error = input.error ?? ((line: string) => console.error(line));
    const reports: MutableCounts = { created: 0, updated: 0, unchanged: 0 };
    const boards: MutableCounts = { created: 0, updated: 0, unchanged: 0 };
    const secrets: string[] = [];
    const fail = (message: string): SetupOutcome => {
        error(`FAILED: ${message}`);
        return { exitCode: 1, reports, boards };
    };

    let token: string;
    try {
        if (input.credentials.kind === 'token') {
            token = input.credentials.token;
        } else {
            secrets.push(input.credentials.password);
            token = await loginUmami({
                baseUrl: input.baseUrl,
                username: input.credentials.username,
                password: input.credentials.password,
                ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {})
            });
        }
    } catch (cause) {
        return fail(describeError(cause, secrets));
    }
    secrets.push(token);

    const config: UmamiClientConfig = {
        baseUrl: input.baseUrl,
        token,
        dryRun: input.dryRun,
        ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {})
    };

    log(`Umami: ${input.baseUrl}`);
    log(`Website: ${input.websiteId}`);
    log(input.dryRun ? 'Mode: DRY RUN (no writes)' : 'Mode: apply');

    const reportIds: Record<string, string> = {};
    for (const definition of buildReportDefinitions()) {
        let result: UpsertResult<{ readonly id: string }>;
        try {
            result = await upsertReport({
                config,
                definition: { ...definition, websiteId: input.websiteId }
            });
        } catch (cause) {
            return fail(`report "${definition.name}": ${describeError(cause, secrets)}`);
        }
        reports[result.action]++;
        reportIds[definition.name] =
            result.resource?.id ?? `${DRY_RUN_PLACEHOLDER_PREFIX}${definition.name}`;
        log(`- report ${result.action}: ${definition.name}`);
    }

    let boardDefinitions: ReturnType<typeof buildBoardDefinitions>;
    try {
        boardDefinitions = buildBoardDefinitions({ websiteId: input.websiteId, reportIds });
    } catch (cause) {
        return fail(`building boards: ${describeError(cause, secrets)}`);
    }
    if (Object.values(reportIds).some((id) => id.startsWith(DRY_RUN_PLACEHOLDER_PREFIX))) {
        log('Note: some reports do not exist yet; boards are planned with placeholder report ids.');
    }

    for (const definition of boardDefinitions) {
        try {
            const result = await upsertBoard({ config, definition });
            boards[result.action]++;
            log(`- board ${result.action}: ${definition.name}`);
        } catch (cause) {
            return fail(`board "${definition.name}": ${describeError(cause, secrets)}`);
        }
    }

    log('');
    log(
        `${'resource'.padEnd(10)}${'created'.padStart(8)}${'updated'.padStart(8)}${'unchanged'.padStart(11)}`
    );
    log(formatRow({ label: 'reports', counts: reports }));
    log(formatRow({ label: 'boards', counts: boards }));
    log(input.dryRun ? 'Dry run completed; nothing was written.' : 'Umami setup completed.');
    return { exitCode: 0, reports, boards };
}

/** Result of {@link resolveSetupInput}. */
export type ResolvedSetupInput =
    | { readonly ok: true; readonly value: RunSetupInput }
    | { readonly ok: false; readonly message: string };

/**
 * Resolves the run input from argv and environment variables.
 *
 * @param input.argv - Arguments after the script name
 * @param input.vars - Environment variables
 * @returns The run input, or a message naming what is missing
 */
export function resolveSetupInput(input: {
    readonly argv: readonly string[];
    readonly vars: Readonly<Record<string, string | undefined>>;
}): ResolvedSetupInput {
    const { argv, vars } = input;
    const unknown = argv.filter((arg) => arg !== '--dry-run');
    if (unknown.length > 0) {
        return {
            ok: false,
            message: `Unknown argument(s): ${unknown.join(' ')}. Usage: umami:setup [--dry-run]`
        };
    }
    const get = (name: string): string => vars[name]?.trim() ?? '';
    const baseUrl = get('HOSPEDA_UMAMI_URL');
    const websiteId = get('HOSPEDA_UMAMI_WEBSITE_ID_WEB');
    const missing: string[] = [];
    if (baseUrl === '') missing.push('HOSPEDA_UMAMI_URL');
    if (websiteId === '') missing.push('HOSPEDA_UMAMI_WEBSITE_ID_WEB');

    const token = get('UMAMI_SETUP_API_KEY') || get('HOSPEDA_UMAMI_API_KEY');
    const username = get('UMAMI_SETUP_USERNAME');
    const password = get('UMAMI_SETUP_PASSWORD');
    let credentials: RunSetupInput['credentials'] | undefined;
    if (token !== '') credentials = { kind: 'token', token };
    else if (username !== '' && password !== '')
        credentials = { kind: 'login', username, password };
    else missing.push('UMAMI_SETUP_API_KEY (or UMAMI_SETUP_USERNAME + UMAMI_SETUP_PASSWORD)');

    if (missing.length > 0 || credentials === undefined) {
        return {
            ok: false,
            message: `Missing required environment variable(s): ${missing.join(', ')}`
        };
    }
    return {
        ok: true,
        value: { baseUrl, websiteId, credentials, dryRun: argv.includes('--dry-run') }
    };
}

async function main(): Promise<void> {
    const resolved = resolveSetupInput({ argv: process.argv.slice(2), vars: process['env'] });
    if (!resolved.ok) {
        console.error(resolved.message);
        process.exitCode = 1;
        return;
    }
    const outcome = await runSetup(resolved.value);
    process.exitCode = outcome.exitCode;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
    void main().catch((cause) => {
        console.error(cause instanceof Error ? cause.message : 'Unexpected failure');
        process.exitCode = 1;
    });
}
