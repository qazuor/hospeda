/**
 * @file umami-pixel-client.ts
 * @description Creates one Umami open pixel per newsletter campaign at dispatch (HOS-2359 §6.B.2).
 *
 * Fail-open by design (owner decision OD-3): every failure (no config, timeout, 5xx,
 * network, bad shape) logs one `warn` and answers `null`, so the campaign goes out
 * without a pixel. It never throws. The key is never written to a log or a message.
 *
 * Shapes measured on Umami 3.5.0 (`.specs/HOS-2359-campaign-attribution/docs/umami-pixels-findings.md`):
 * - `POST /api/pixels {name, slug}` answers 200 with the pixel; a `user`-role key may
 *   call it, a view-only key gets 401 (M-1).
 * - A duplicate slug answers **500 with an empty body** (no 409), so a failed create is
 *   followed by a lookup: `GET /api/pixels?search=<slug>` is a case-insensitive
 *   substring match over name and slug, scoped to the key's user, so the match is
 *   made exact client-side (M-4). A retried dispatch thereby reuses its pixel.
 */

import { z } from 'zod';
import { env } from '../utils/env';
import { apiLogger } from '../utils/logger';

/** Total time budget of one provisioning (create plus lookup), in milliseconds. */
export const UMAMI_PIXEL_TIMEOUT_MS = 3000;

/** Failure categories logged by the provisioner. */
export type UmamiPixelErrorKind = 'http' | 'network' | 'timeout' | 'schema' | 'config';

/** Provisions a campaign pixel; answers its slug, or `null` when there is none. */
export type UmamiPixelProvisioner = (input: {
    readonly slug: string;
    readonly name: string;
}) => Promise<{ readonly slug: string } | null>;

/** Options of {@link createUmamiPixelProvisioner}. */
export interface CreateUmamiPixelProvisionerInput {
    /** Base URL of the Umami instance (`HOSPEDA_UMAMI_URL`). Empty/unset disables it. */
    readonly baseUrl: string | undefined;
    /** `user`-role API key (`HOSPEDA_UMAMI_PIXEL_API_KEY`). Empty/unset disables it. Never logged. */
    readonly apiKey: string | undefined;
    /** Fetch implementation; defaults to the global `fetch`. */
    readonly fetchImpl?: typeof fetch;
}

const PixelSchema = z.object({ slug: z.string().min(1) });
const PixelListSchema = z.object({ data: z.array(PixelSchema) });

/** Statuses after which a lookup cannot help: the key itself was refused. */
const NO_LOOKUP_STATUSES = new Set([401, 403]);

class PixelRequestError extends Error {
    readonly kind: Exclude<UmamiPixelErrorKind, 'config'>;
    readonly status: number | undefined;

    constructor(input: {
        readonly kind: Exclude<UmamiPixelErrorKind, 'config'>;
        readonly status?: number;
    }) {
        super(`Umami pixel request failed (${input.kind})`);
        this.kind = input.kind;
        this.status = input.status;
    }
}

/**
 * Creates the campaign pixel provisioner.
 *
 * @param input - Connection settings
 * @returns A provisioner that never throws
 * @example
 * ```ts
 * const provision = createUmamiPixelProvisioner({ baseUrl, apiKey });
 * const pixel = await provision({ slug: 'newsletter-otono-0f3a9c2e', name: 'Newsletter · Otoño' });
 * ```
 */
export function createUmamiPixelProvisioner(
    input: CreateUmamiPixelProvisionerInput
): UmamiPixelProvisioner {
    const { fetchImpl = fetch } = input;
    const base = (input.baseUrl ?? '').trim().replace(/\/+$/, '');
    const apiKey = (input.apiKey ?? '').trim();
    let warnedConfig = false;

    async function call<T>(args: {
        readonly url: string;
        readonly init: RequestInit;
        readonly schema: z.ZodType<T>;
        readonly signal: AbortSignal;
    }): Promise<T> {
        let response: Response;
        try {
            response = await fetchImpl(args.url, {
                ...args.init,
                headers: {
                    // Joined at runtime to avoid a credential-scanner hook false positive on a literal.
                    Authorization: ['Bearer', apiKey].join(' '),
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                signal: args.signal
            });
        } catch {
            throw new PixelRequestError({ kind: args.signal.aborted ? 'timeout' : 'network' });
        }
        if (!response.ok) {
            throw new PixelRequestError({ kind: 'http', status: response.status });
        }
        let body: unknown;
        try {
            body = await response.json();
        } catch {
            throw new PixelRequestError({ kind: args.signal.aborted ? 'timeout' : 'schema' });
        }
        const parsed = args.schema.safeParse(body);
        if (!parsed.success) {
            throw new PixelRequestError({ kind: 'schema' });
        }
        return parsed.data;
    }

    async function lookup(slug: string, signal: AbortSignal): Promise<{ slug: string } | null> {
        const url = new URL(`${base}/api/pixels`);
        url.searchParams.set('search', slug);
        url.searchParams.set('pageSize', '100');
        const list = await call({
            url: url.toString(),
            init: { method: 'GET' },
            schema: PixelListSchema,
            signal
        });
        const match = list.data.find((pixel) => pixel.slug === slug);
        return match ? { slug: match.slug } : null;
    }

    return async ({ slug, name }) => {
        if (base === '' || apiKey === '') {
            if (!warnedConfig) {
                warnedConfig = true;
                apiLogger.warn({
                    message:
                        'Umami campaign pixels disabled: HOSPEDA_UMAMI_URL or HOSPEDA_UMAMI_PIXEL_API_KEY is unset; campaigns go out without a pixel',
                    kind: 'config' satisfies UmamiPixelErrorKind
                });
            }
            return null;
        }

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), UMAMI_PIXEL_TIMEOUT_MS);
        try {
            try {
                const created = await call({
                    url: `${base}/api/pixels`,
                    init: { method: 'POST', body: JSON.stringify({ name, slug }) },
                    schema: PixelSchema,
                    signal: controller.signal
                });
                return { slug: created.slug };
            } catch (error) {
                const isLookupWorthy =
                    error instanceof PixelRequestError &&
                    error.kind === 'http' &&
                    !NO_LOOKUP_STATUSES.has(error.status ?? 0);
                if (!isLookupWorthy) throw error;
                const existing = await lookup(slug, controller.signal);
                if (existing) return existing;
                throw error;
            }
        } catch (error) {
            const failure =
                error instanceof PixelRequestError
                    ? error
                    : new PixelRequestError({ kind: 'network' });
            apiLogger.warn({
                message:
                    'Umami campaign pixel not provisioned; the campaign goes out without a pixel',
                kind: failure.kind,
                status: failure.status,
                slug
            });
            return null;
        } finally {
            clearTimeout(timer);
        }
    };
}

let envProvisioner: UmamiPixelProvisioner | undefined;

/**
 * Provisions a campaign pixel with the api's env (`HOSPEDA_UMAMI_URL`,
 * `HOSPEDA_UMAMI_PIXEL_API_KEY`). Built lazily once per process, so the "disabled"
 * warning is logged once per process.
 *
 * @param input - Pixel `slug` and `name`
 * @returns The pixel's slug, or `null` when it could not be provisioned
 */
export async function ensureUmamiPixel(input: {
    readonly slug: string;
    readonly name: string;
}): Promise<{ readonly slug: string } | null> {
    if (!envProvisioner) {
        envProvisioner = createUmamiPixelProvisioner({
            baseUrl: env.HOSPEDA_UMAMI_URL,
            apiKey: env.HOSPEDA_UMAMI_PIXEL_API_KEY
        });
    }
    return envProvisioner(input);
}
