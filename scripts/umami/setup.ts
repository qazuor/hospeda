/**
 * @file setup.ts
 * @description Idempotent Umami dashboards-as-code setup (HOS-2119, AC-6).
 *
 * Upserts every saved report first, then the boards that reference them by id,
 * then the segments and cohorts, then the WEB website's session recorder config
 * (HOS-2347, `recorder-definitions.ts`), then one open pixel per email catalog
 * template from the generated manifest (HOS-2359, `pixels-client.ts`). Re-running changes nothing (second run reports
 * everything as unchanged). Items that exist in Umami but are not defined here
 * are only listed ("unmanaged"), never modified or deleted.
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
    listBoards,
    listReports,
    loginUmami,
    UmamiApiError,
    type UmamiClientConfig,
    type UpsertResult,
    upsertBoard,
    upsertReport
} from './client.js';
import { buildReportDefinitions } from './definitions.js';
import {
    listPixels,
    loadEmailPixelDefinitions,
    MANAGED_PIXEL_PREFIX,
    type PixelDefinition,
    type UmamiPixel,
    upsertPixel
} from './pixels-client.js';
import { upsertRecorderConfig } from './recorder-client.js';
import { buildRecorderDefinition } from './recorder-definitions.js';
import { buildSegmentDefinitions, type SegmentType } from './segment-definitions.js';
import { listSegments, upsertSegment } from './segments-client.js';

/** Prefix of the id used for a report a dry-run would create (it does not exist yet). */
export const DRY_RUN_PLACEHOLDER_PREFIX = 'dry-run-placeholder:';

/** Counts of one resource kind. */
export interface ActionCounts {
    readonly created: number;
    readonly updated: number;
    readonly unchanged: number;
}

/** A resource that exists in Umami but is not defined in the script. */
export interface UnmanagedItem {
    readonly kind: 'report' | 'board' | 'segment' | 'cohort' | 'recorder-config-key' | 'pixel';
    readonly name: string;
}

/** Outcome of {@link runSetup}. */
export interface SetupOutcome {
    /** 0 on success, 1 on any error. */
    readonly exitCode: 0 | 1;
    readonly reports: ActionCounts;
    readonly boards: ActionCounts;
    readonly segments: ActionCounts;
    readonly cohorts: ActionCounts;
    /** The WEB website's recorder config: one item, `updated` or `unchanged`. */
    readonly recorder: ActionCounts;
    /** Email template pixels (HOS-2359). */
    readonly pixels: ActionCounts;
    /** Report-only: existing items not defined in the script. Left untouched. */
    readonly unmanaged: readonly UnmanagedItem[];
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
    /** Email template pixels to upsert; defaults to the generated manifest (HOS-2359). */
    readonly pixelDefinitions?: readonly PixelDefinition[];
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

async function findUnmanaged(input: {
    readonly config: UmamiClientConfig;
    readonly websiteId: string;
    readonly reportNames: ReadonlySet<string>;
    readonly boardNames: ReadonlySet<string>;
    readonly segmentDefinitions: ReturnType<typeof buildSegmentDefinitions>;
}): Promise<readonly UnmanagedItem[]> {
    const { config, websiteId } = input;
    const items: UnmanagedItem[] = [];
    for (const r of await listReports({ config, websiteId })) {
        if (!input.reportNames.has(r.name)) items.push({ kind: 'report', name: r.name });
    }
    for (const b of await listBoards({ config })) {
        if (!input.boardNames.has(b.name)) items.push({ kind: 'board', name: b.name });
    }
    for (const type of ['segment', 'cohort'] as const satisfies readonly SegmentType[]) {
        const defined = new Set(
            input.segmentDefinitions.filter((d) => d.type === type).map((d) => d.name)
        );
        for (const s of await listSegments({ config, websiteId, type })) {
            if (!defined.has(s.name)) items.push({ kind: type, name: s.name });
        }
    }
    return items;
}

/**
 * Runs the setup: reports, boards, then segments and cohorts. Never throws; failures are
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
    const segments: MutableCounts = { created: 0, updated: 0, unchanged: 0 };
    const cohorts: MutableCounts = { created: 0, updated: 0, unchanged: 0 };
    const recorder: MutableCounts = { created: 0, updated: 0, unchanged: 0 };
    const pixels: MutableCounts = { created: 0, updated: 0, unchanged: 0 };
    const secrets: string[] = [];
    const fail = (message: string): SetupOutcome => {
        error(`FAILED: ${message}`);
        return {
            exitCode: 1,
            reports,
            boards,
            segments,
            cohorts,
            recorder,
            pixels,
            unmanaged: []
        };
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

    let segmentDefinitions: ReturnType<typeof buildSegmentDefinitions>;
    try {
        segmentDefinitions = buildSegmentDefinitions();
    } catch (cause) {
        return fail(`building segments: ${describeError(cause, secrets)}`);
    }
    for (const definition of segmentDefinitions) {
        try {
            const result = await upsertSegment({
                config,
                websiteId: input.websiteId,
                definition
            });
            (definition.type === 'cohort' ? cohorts : segments)[result.action]++;
            log(`- ${definition.type} ${result.action}: ${definition.name}`);
        } catch (cause) {
            return fail(
                `${definition.type} "${definition.name}": ${describeError(cause, secrets)}`
            );
        }
    }

    const recorderUnmanaged: UnmanagedItem[] = [];
    try {
        const plan = await upsertRecorderConfig({
            config,
            websiteId: input.websiteId,
            desired: buildRecorderDefinition()
        });
        recorder[plan.action]++;
        log(`- recorder ${plan.action}: website ${input.websiteId}`);
        for (const change of plan.changes) {
            log(
                `    ${change.field}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`
            );
        }
        for (const key of plan.unmanagedKeys) {
            recorderUnmanaged.push({ kind: 'recorder-config-key', name: key });
        }
    } catch (cause) {
        return fail(`recorder config: ${describeError(cause, secrets)}`);
    }

    let pixelDefinitions: readonly PixelDefinition[];
    let storedPixels: readonly UmamiPixel[];
    try {
        pixelDefinitions = input.pixelDefinitions ?? loadEmailPixelDefinitions();
        storedPixels = await listPixels({ config });
    } catch (cause) {
        return fail(`email pixels: ${describeError(cause, secrets)}`);
    }
    for (const definition of pixelDefinitions) {
        try {
            const result = await upsertPixel({ config, definition, existing: storedPixels });
            pixels[result.action]++;
            if (result.action !== 'unchanged') {
                log(`- pixel ${result.action}: ${definition.slug}`);
            }
        } catch (cause) {
            return fail(`pixel "${definition.slug}": ${describeError(cause, secrets)}`);
        }
    }
    // Template pixels this script owns but the manifest no longer lists. Newsletter
    // pixels (`newsletter-*`) belong to the api and are ignored.
    const definedPixelSlugs = new Set(pixelDefinitions.map((d) => d.slug));
    const pixelUnmanaged: UnmanagedItem[] = storedPixels
        .filter((p) => p.slug.startsWith(MANAGED_PIXEL_PREFIX) && !definedPixelSlugs.has(p.slug))
        .map((p) => ({ kind: 'pixel', name: p.slug }));

    const unmanaged: UnmanagedItem[] = [];
    try {
        unmanaged.push(
            ...(await findUnmanaged({
                config,
                websiteId: input.websiteId,
                reportNames: new Set(buildReportDefinitions().map((d) => d.name)),
                boardNames: new Set(boardDefinitions.map((d) => d.name)),
                segmentDefinitions
            }))
        );
    } catch (cause) {
        // Report-only step: everything was already applied, so do not fail the run.
        unmanaged.length = 0;
        log(`Warning: could not list unmanaged items: ${describeError(cause, secrets)}`);
    }
    unmanaged.push(...recorderUnmanaged, ...pixelUnmanaged);
    if (unmanaged.length > 0) {
        log('');
        log('Unmanaged (left untouched):');
        for (const item of unmanaged) log(`- ${item.kind}: ${item.name}`);
    }

    log('');
    log(
        `${'resource'.padEnd(10)}${'created'.padStart(8)}${'updated'.padStart(8)}${'unchanged'.padStart(11)}`
    );
    log(formatRow({ label: 'reports', counts: reports }));
    log(formatRow({ label: 'boards', counts: boards }));
    log(formatRow({ label: 'segments', counts: segments }));
    log(formatRow({ label: 'cohorts', counts: cohorts }));
    log(formatRow({ label: 'recorder', counts: recorder }));
    log(formatRow({ label: 'pixels', counts: pixels }));
    log(input.dryRun ? 'Dry run completed; nothing was written.' : 'Umami setup completed.');
    return { exitCode: 0, reports, boards, segments, cohorts, recorder, pixels, unmanaged };
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
