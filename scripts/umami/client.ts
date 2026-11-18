import { z } from 'zod';

/**
 * Minimal Umami (3.5.x) API client for the dashboards-as-code setup script.
 *
 * Native `fetch`, Zod-validated responses, a typed error that never carries the
 * token, and idempotent upsert helpers for reports and boards. Endpoint shapes
 * were measured against Umami 3.5.0 (see
 * `.specs/HOS-2119-posthog-to-umami/docs/umami-spike-findings.md`, "T-037").
 */

/** JSON-compatible value (report/board `parameters` are free-form records). */
export type JsonValue =
    | string
    | number
    | boolean
    | null
    | readonly JsonValue[]
    | { readonly [key: string]: JsonValue };

/** Umami report types accepted by `POST /api/reports` (measured). */
export const REPORT_TYPES = [
    'attribution',
    'breakdown',
    'funnel',
    'goal',
    'heatmap',
    'journey',
    'performance',
    'retention',
    'revenue',
    'utm'
] as const;

/** A report type. */
export type ReportType = (typeof REPORT_TYPES)[number];

/** Umami board types accepted by `POST /api/boards` (measured). */
export const BOARD_TYPES = ['mixed', 'website', 'pixel', 'link'] as const;

/** A board type. */
export type BoardType = (typeof BOARD_TYPES)[number];

const parametersSchema = z.record(z.string(), z.unknown());

/** Zod schema of a report as returned by the API. */
export const reportSchema = z.object({
    id: z.string(),
    websiteId: z.string(),
    type: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    parameters: parametersSchema
});

/** A report as returned by the API. */
export type UmamiReport = z.infer<typeof reportSchema>;

/** Zod schema of a board as returned by the API. */
export const boardSchema = z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    description: z.string().nullable().optional(),
    parameters: parametersSchema
});

/** A board as returned by the API. */
export type UmamiBoard = z.infer<typeof boardSchema>;

const listEnvelopeSchema = z.object({
    data: z.array(z.unknown()),
    count: z.number(),
    page: z.number(),
    pageSize: z.number()
});

const loginResponseSchema = z.object({ token: z.string().min(1) });

/** Failure category of an {@link UmamiApiError}. */
export type UmamiErrorKind = 'http' | 'network' | 'schema' | 'ambiguous';

/**
 * Error raised by the Umami client. Carries the HTTP status (0 when no response
 * was received) and the endpoint path (no query string). It never contains the
 * token: any occurrence of it in server-provided text is redacted.
 */
export class UmamiApiError extends Error {
    public readonly status: number;
    public readonly endpoint: string;
    public readonly kind: UmamiErrorKind;

    /**
     * @param input.message - Human readable message (already token-free)
     * @param input.status - HTTP status, 0 when there was no response
     * @param input.endpoint - Request path without query string
     * @param input.kind - Failure category
     */
    constructor(input: {
        readonly message: string;
        readonly status: number;
        readonly endpoint: string;
        readonly kind: UmamiErrorKind;
    }) {
        super(input.message);
        this.name = 'UmamiApiError';
        this.status = input.status;
        this.endpoint = input.endpoint;
        this.kind = input.kind;
    }
}

/** Connection settings shared by every client function. */
export interface UmamiClientConfig {
    /** Base URL of the Umami instance, e.g. `http://127.0.0.1:3010`. */
    readonly baseUrl: string;
    /** Login token or `umami_...` API key. Sent as a bearer credential. */
    readonly token: string;
    /** When true, upserts perform reads only and return the planned action. */
    readonly dryRun?: boolean;
    /** Injected fetch (tests). Defaults to the global `fetch`. */
    readonly fetchImpl?: typeof fetch;
}

type HttpMethod = 'GET' | 'POST' | 'DELETE';

function redact(text: string, secret: string): string {
    return secret.length > 0 ? text.split(secret).join('[redacted]') : text;
}

function authHeader(token: string): string {
    return ['Bearer', token].join(' ');
}

function buildUrl(input: {
    readonly baseUrl: string;
    readonly path: string;
    readonly query?: Readonly<Record<string, string | number>>;
}): string {
    const url = new URL(input.path, `${input.baseUrl.replace(/\/+$/, '')}/`);
    for (const [key, value] of Object.entries(input.query ?? {})) {
        url.searchParams.set(key, String(value));
    }
    return url.toString();
}

/**
 * Performs one authenticated request and validates the JSON response.
 *
 * @param input.config - Client configuration
 * @param input.method - HTTP method
 * @param input.path - Path starting with `/api/`
 * @param input.query - Optional query parameters
 * @param input.body - Optional JSON body
 * @param input.schema - Zod schema the response must satisfy
 * @returns The parsed response
 * @throws {UmamiApiError} On network failure, non-2xx status or schema mismatch
 */
export async function umamiRequest<S extends z.ZodTypeAny>(input: {
    readonly config: Pick<UmamiClientConfig, 'baseUrl' | 'token' | 'fetchImpl'>;
    readonly method: HttpMethod;
    readonly path: string;
    readonly query?: Readonly<Record<string, string | number>>;
    readonly body?: unknown;
    readonly schema: S;
}): Promise<z.infer<S>> {
    const { config, method, path, query, body, schema } = input;
    const doFetch = config.fetchImpl ?? fetch;
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (config.token.length > 0) headers.Authorization = authHeader(config.token);
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
        response = await doFetch(buildUrl({ baseUrl: config.baseUrl, path, query }), {
            method,
            headers,
            ...(body === undefined ? {} : { body: JSON.stringify(body) })
        });
    } catch (cause) {
        const reason = cause instanceof Error ? cause.message : 'unknown error';
        throw new UmamiApiError({
            message: redact(`${method} ${path} failed: ${reason}`, config.token),
            status: 0,
            endpoint: path,
            kind: 'network'
        });
    }

    const text = await response.text();
    if (!response.ok) {
        throw new UmamiApiError({
            message: redact(
                `${method} ${path} answered ${response.status}: ${text.slice(0, 300)}`,
                config.token
            ),
            status: response.status,
            endpoint: path,
            kind: 'http'
        });
    }

    let json: unknown;
    try {
        json = JSON.parse(text);
    } catch {
        throw new UmamiApiError({
            message: `${method} ${path} answered a non-JSON body`,
            status: response.status,
            endpoint: path,
            kind: 'schema'
        });
    }
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
        throw new UmamiApiError({
            message: redact(
                `${method} ${path} response failed validation: ${parsed.error.issues
                    .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
                    .join('; ')}`,
                config.token
            ),
            status: response.status,
            endpoint: path,
            kind: 'schema'
        });
    }
    return parsed.data;
}

/**
 * Logs in with username and password and returns the session token.
 * This is a POST but creates no Umami resource, so it is allowed in dry-run.
 *
 * @param input.baseUrl - Base URL of the instance
 * @param input.username - Umami username
 * @param input.password - Umami password (never included in errors)
 * @param input.fetchImpl - Optional injected fetch
 * @returns The bearer token
 * @throws {UmamiApiError} On failure
 */
export async function loginUmami(input: {
    readonly baseUrl: string;
    readonly username: string;
    readonly password: string;
    readonly fetchImpl?: typeof fetch;
}): Promise<string> {
    const result = await umamiRequest({
        config: {
            baseUrl: input.baseUrl,
            token: '',
            ...(input.fetchImpl ? { fetchImpl: input.fetchImpl } : {})
        },
        method: 'POST',
        path: '/api/auth/login',
        body: { username: input.username, password: input.password },
        schema: loginResponseSchema
    });
    return result.token;
}

const LIST_PAGE_SIZE = 100;
const MAX_PAGES = 100;

/** Lists every item of a paginated Umami endpoint, validating each item. */
export async function listAll<S extends z.ZodTypeAny>(input: {
    readonly config: UmamiClientConfig;
    readonly path: string;
    readonly query?: Readonly<Record<string, string | number>>;
    readonly schema: S;
}): Promise<readonly z.infer<S>[]> {
    const items: z.infer<S>[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
        const envelope = await umamiRequest({
            config: input.config,
            method: 'GET',
            path: input.path,
            query: { ...input.query, page, pageSize: LIST_PAGE_SIZE },
            schema: listEnvelopeSchema
        });
        for (const raw of envelope.data) {
            const parsed = input.schema.safeParse(raw);
            if (!parsed.success) {
                throw new UmamiApiError({
                    message: `GET ${input.path} item failed validation: ${parsed.error.issues
                        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
                        .join('; ')}`,
                    status: 200,
                    endpoint: input.path,
                    kind: 'schema'
                });
            }
            items.push(parsed.data);
        }
        // The server may clamp pageSize, so stop on what was actually received.
        if (envelope.data.length === 0 || items.length >= envelope.count) break;
    }
    return items;
}

/**
 * Lists every report of a website (all pages).
 *
 * @param input.config - Client configuration
 * @param input.websiteId - Website id (the API requires it)
 */
export function listReports(input: {
    readonly config: UmamiClientConfig;
    readonly websiteId: string;
}): Promise<readonly UmamiReport[]> {
    return listAll({
        config: input.config,
        path: '/api/reports',
        query: { websiteId: input.websiteId },
        schema: reportSchema
    });
}

/**
 * Lists every board of the authenticated user (all pages).
 *
 * @param input.config - Client configuration
 */
export function listBoards(input: {
    readonly config: UmamiClientConfig;
}): Promise<readonly UmamiBoard[]> {
    return listAll({ config: input.config, path: '/api/boards', schema: boardSchema });
}

/** Outcome of an upsert. `dryRun` true means nothing was written. */
export interface UpsertResult<T> {
    readonly action: 'created' | 'updated' | 'unchanged';
    readonly dryRun: boolean;
    /** The stored resource, or `null` when a dry-run planned a creation. */
    readonly resource: T | null;
}

function canonical(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value !== null && typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>)
            .filter(([, v]) => v !== undefined)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
    }
    return JSON.stringify(value) ?? 'null';
}

/**
 * Key-order-insensitive deep equality of two JSON values (Umami may reorder
 * keys inside `parameters` when it stores them).
 */
export function sameJson(a: unknown, b: unknown): boolean {
    return canonical(a) === canonical(b);
}

/** Returns the single match, `undefined` for none, or throws `ambiguous` for several. */
export function pickUnique<T extends { readonly id: string }>(input: {
    readonly matches: readonly T[];
    readonly label: string;
    readonly endpoint: string;
}): T | undefined {
    if (input.matches.length > 1) {
        throw new UmamiApiError({
            message: `${input.matches.length} ${input.label} share the same name; refusing to guess`,
            status: 0,
            endpoint: input.endpoint,
            kind: 'ambiguous'
        });
    }
    return input.matches[0];
}

/** Desired state of a report. Natural key: `websiteId` + `name`. */
export interface ReportDefinition {
    readonly websiteId: string;
    readonly type: ReportType;
    readonly name: string;
    readonly description?: string;
    readonly parameters: Readonly<Record<string, JsonValue>>;
}

/**
 * Creates the report when absent, updates it when it differs, does nothing when
 * equal. In dry-run it performs the read and returns the planned action only.
 *
 * @param input.config - Client configuration (`dryRun` honoured)
 * @param input.definition - Desired report
 * @returns What happened (or would happen)
 * @throws {UmamiApiError} On API failure or when the name is ambiguous
 */
export async function upsertReport(input: {
    readonly config: UmamiClientConfig;
    readonly definition: ReportDefinition;
}): Promise<UpsertResult<UmamiReport>> {
    const { config, definition } = input;
    const dryRun = config.dryRun === true;
    const existing = pickUnique({
        matches: (await listReports({ config, websiteId: definition.websiteId })).filter(
            (r) => r.name === definition.name
        ),
        label: `reports named "${definition.name}"`,
        endpoint: '/api/reports'
    });
    const body = { ...definition, description: definition.description ?? '' };

    if (!existing) {
        if (dryRun) return { action: 'created', dryRun, resource: null };
        const created = await umamiRequest({
            config,
            method: 'POST',
            path: '/api/reports',
            body,
            schema: reportSchema
        });
        return { action: 'created', dryRun, resource: created };
    }

    const unchanged =
        existing.type === body.type &&
        (existing.description ?? '') === body.description &&
        sameJson(existing.parameters, body.parameters);
    if (unchanged) return { action: 'unchanged', dryRun, resource: existing };
    if (dryRun) return { action: 'updated', dryRun, resource: existing };
    const updated = await umamiRequest({
        config,
        method: 'POST',
        path: `/api/reports/${existing.id}`,
        body,
        schema: reportSchema
    });
    return { action: 'updated', dryRun, resource: updated };
}

/** Desired state of a board. Natural key: `name` (boards are not per-website). */
export interface BoardDefinition {
    readonly type: BoardType;
    readonly name: string;
    readonly description?: string;
    readonly parameters: Readonly<Record<string, JsonValue>>;
}

/**
 * Board counterpart of {@link upsertReport}.
 *
 * @param input.config - Client configuration (`dryRun` honoured)
 * @param input.definition - Desired board
 * @returns What happened (or would happen)
 * @throws {UmamiApiError} On API failure or when the name is ambiguous
 */
export async function upsertBoard(input: {
    readonly config: UmamiClientConfig;
    readonly definition: BoardDefinition;
}): Promise<UpsertResult<UmamiBoard>> {
    const { config, definition } = input;
    const dryRun = config.dryRun === true;
    const existing = pickUnique({
        matches: (await listBoards({ config })).filter((b) => b.name === definition.name),
        label: `boards named "${definition.name}"`,
        endpoint: '/api/boards'
    });
    const body = { ...definition, description: definition.description ?? '' };

    if (!existing) {
        if (dryRun) return { action: 'created', dryRun, resource: null };
        const created = await umamiRequest({
            config,
            method: 'POST',
            path: '/api/boards',
            body,
            schema: boardSchema
        });
        return { action: 'created', dryRun, resource: created };
    }

    const unchanged =
        existing.type === body.type &&
        (existing.description ?? '') === body.description &&
        sameJson(existing.parameters, body.parameters);
    if (unchanged) return { action: 'unchanged', dryRun, resource: existing };
    if (dryRun) return { action: 'updated', dryRun, resource: existing };
    const updated = await umamiRequest({
        config,
        method: 'POST',
        path: `/api/boards/${existing.id}`,
        body,
        schema: boardSchema
    });
    return { action: 'updated', dryRun, resource: updated };
}
