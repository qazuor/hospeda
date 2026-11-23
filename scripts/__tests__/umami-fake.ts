/**
 * Shared in-memory Umami fake and run-input builder for the `umami:setup`
 * tests (HOS-2119, extended by HOS-2347 with the website recorder endpoint).
 * Not a test file: vitest only collects `*.test.ts`.
 */
import { buildReportDefinitions } from '../umami/definitions.js';
import type { PixelDefinition } from '../umami/pixels-client.js';
import { buildSegmentDefinitions } from '../umami/segment-definitions.js';
import type { RunSetupInput } from '../umami/setup.js';

/** The `replay_config` keys Umami 3.5 keeps on a write (measured; written out, not imported). */
const UMAMI_KNOWN_REPLAY_KEYS: ReadonlySet<string> = new Set([
    'replayEnabled',
    'heatmapEnabled',
    'sampleRate',
    'heatmapSampleRate',
    'maskLevel',
    'maxDuration',
    'blockSelector'
]);

/** Bearer token the fake accepts; must never appear in output. */
export const TOKEN = 'tok-SECRET-xyz';
/** Fake login credential, built at runtime so the pre-commit secret scanner does not flag a fixture. */
export const FAKE_LOGIN = ['fixture', 'login', 'value'].join('-');
/** The WEB website id the fake serves. */
export const WEBSITE = 'site-1';
/** Number of declared reports. */
export const REPORT_COUNT = buildReportDefinitions().length;
/** Number of declared boards. */
export const BOARD_COUNT = 7;
/** Number of declared segments. */
export const SEGMENT_COUNT = buildSegmentDefinitions().filter((d) => d.type === 'segment').length;
/** Number of declared cohorts. */
export const COHORT_COUNT = buildSegmentDefinitions().filter((d) => d.type === 'cohort').length;

/** Small pixel set the setup tests upsert instead of the 125-entry manifest. */
export const TEST_PIXELS: readonly PixelDefinition[] = [
    { name: 'Email · Verificar email', slug: 'email-auth-verify-email' },
    { name: 'Email · Restablecer contraseña', slug: 'email-auth-reset-password' }
];

/** One request seen by the fake. */
export interface Call {
    readonly method: string;
    readonly path: string;
}

/** A stored report, board, segment or cohort. */
export interface Stored {
    id: string;
    name: string;
    [key: string]: unknown;
}

/** The website row the recorder step reads and writes (HOS-2347). */
export interface StoredWebsite {
    id: string;
    name: string;
    domain: string;
    recorderEnabled: boolean;
    replayConfig: Record<string, unknown> | null;
}

/**
 * Stateful in-memory fake of the Umami endpoints the setup touches.
 *
 * `POST /api/websites/:id` follows the measured Umami 3.5 semantics: only
 * `replayConfig` is read, it is MERGED over the stored config, `false` booleans
 * are dropped, unknown keys are dropped (like real Umami), and
 * `recorderEnabled` is derived from `replayEnabled || heatmapEnabled`.
 */
export function fakeUmami(
    input: {
        readonly failReportPosts?: boolean;
        readonly failReportListsAfter?: number;
        readonly website?: Partial<StoredWebsite>;
    } = {}
): {
    fetchImpl: typeof fetch;
    calls: Call[];
    reports: Stored[];
    boards: Stored[];
    segments: Stored[];
    pixels: Stored[];
    website: StoredWebsite;
} {
    const website: StoredWebsite = {
        id: WEBSITE,
        name: 'hospeda-web',
        domain: 'hospeda.com.ar',
        recorderEnabled: false,
        replayConfig: null,
        ...input.website
    };
    const reports: Stored[] = [];
    const boards: Stored[] = [];
    const segments: Stored[] = [];
    const pixels: Stored[] = [];
    const calls: Call[] = [];
    let seq = 0;
    let reportListCalls = 0;
    const json = (status: number, body: unknown): Response =>
        new Response(JSON.stringify(body), { status });
    const envelope = (data: readonly unknown[]) => ({
        data,
        count: data.length,
        page: 1,
        pageSize: 100
    });

    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
        const parsed = new URL(String(url));
        const method = init?.method ?? 'GET';
        const path = parsed.pathname;
        calls.push({ method, path });
        const body: Record<string, unknown> =
            typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        if (path === '/api/auth/login') {
            return body['password'] === FAKE_LOGIN
                ? json(200, { token: TOKEN })
                : json(401, { error: 'bad' });
        }
        if (path === `/api/websites/${WEBSITE}`) {
            if (method === 'POST' && body['replayConfig'] !== undefined) {
                const merged: Record<string, unknown> = {
                    ...(website.replayConfig ?? {}),
                    ...(body['replayConfig'] as Record<string, unknown>)
                };
                // Measured Umami 3.5: the merged config is normalized, which
                // keeps only the seven known keys and drops `false` booleans.
                for (const [key, value] of Object.entries(merged)) {
                    if (value === false || !UMAMI_KNOWN_REPLAY_KEYS.has(key)) delete merged[key];
                }
                website.replayConfig = merged;
                website.recorderEnabled =
                    merged['replayEnabled'] === true || merged['heatmapEnabled'] === true;
            }
            return json(200, { ...website, shareId: null });
        }
        if (path.startsWith('/api/pixels')) {
            if (method === 'GET') return json(200, envelope(pixels));
            const pixelId = path.slice('/api/pixels'.length + 1);
            if (pixelId) {
                const target = pixels.find((p) => p.id === pixelId);
                if (!target) return json(404, {});
                Object.assign(target, body);
                return json(200, target);
            }
            // Measured Umami 3.5: a duplicate slug answers 500 with an empty body.
            if (pixels.some((p) => p['slug'] === body['slug'])) {
                return new Response('', { status: 500 });
            }
            seq++;
            const created = { ...body, id: `px-${seq}`, name: String(body['name']) } as Stored;
            pixels.push(created);
            return json(200, created);
        }
        const segmentBase = `/api/websites/${WEBSITE}/segments`;
        if (path.startsWith(segmentBase)) {
            if (method === 'GET') {
                const type = parsed.searchParams.get('type');
                return json(200, envelope(segments.filter((s) => s['type'] === type)));
            }
            const segmentId = path.slice(segmentBase.length + 1);
            if (segmentId) {
                const target = segments.find((s) => s.id === segmentId);
                if (!target) return json(404, {});
                Object.assign(target, body);
                return json(200, target);
            }
            seq++;
            const created = { ...body, id: `id-${seq}`, name: String(body['name']) } as Stored;
            segments.push(created);
            return json(200, created);
        }
        if (path === '/api/reports' && method === 'GET') {
            reportListCalls++;
            if (
                input.failReportListsAfter !== undefined &&
                reportListCalls > input.failReportListsAfter
            ) {
                return json(500, { error: `list boom ${TOKEN}` });
            }
        }
        const store = path.startsWith('/api/reports') ? reports : boards;
        const base = path.startsWith('/api/reports') ? '/api/reports' : '/api/boards';
        if (method === 'GET') return json(200, envelope(store));
        if (base === '/api/reports' && input.failReportPosts) {
            return json(500, { error: `boom ${TOKEN}` });
        }
        const idFromPath = path.slice(base.length + 1);
        if (idFromPath) {
            const target = store.find((s) => s.id === idFromPath);
            if (!target) return json(404, {});
            Object.assign(target, body);
            return json(200, target);
        }
        seq++;
        const created = { ...body, id: `id-${seq}`, name: String(body['name']) } as Stored;
        store.push(created);
        return json(200, created);
    }) as typeof fetch;
    return { fetchImpl, calls, reports, boards, segments, pixels, website };
}

/** Builds a run input with captured stdout and stderr. */
export function baseInput(over: Partial<RunSetupInput> & { fetchImpl: typeof fetch }): {
    input: RunSetupInput;
    out: string[];
    err: string[];
} {
    const out: string[] = [];
    const err: string[] = [];
    return {
        out,
        err,
        input: {
            baseUrl: 'http://umami.test',
            websiteId: WEBSITE,
            credentials: { kind: 'token', token: TOKEN },
            dryRun: false,
            pixelDefinitions: TEST_PIXELS,
            log: (l) => out.push(l),
            error: (l) => err.push(l),
            ...over
        }
    };
}

/** The non-GET requests, login excluded. */
export const writes = (calls: readonly Call[]) =>
    calls.filter((c) => c.method !== 'GET' && c.path !== '/api/auth/login');
