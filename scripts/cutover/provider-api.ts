import { z } from 'zod';
import type {
    CancelCallResult,
    ListPage,
    ObjectKind,
    ProviderApi,
    ProviderObject
} from './types.ts';

/** Production base URL of the provider API. Tests inject a fake `fetchImpl` instead. */
export const DEFAULT_PROVIDER_BASE_URL = 'https://api.mercadopago.com';

const KIND_PATH: Readonly<Record<ObjectKind, string>> = {
    plan: '/preapproval_plan',
    preapproval: '/preapproval'
};

/** What the provider takes as the cancelling status for each family (a plan is set `inactive`). */
const CANCEL_STATUS: Readonly<Record<ObjectKind, string>> = {
    plan: 'inactive',
    preapproval: 'cancelled'
};

const SAFE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 4;
const DEFAULT_RETRY_DELAY_MS = 1_000;

const idSchema = z.union([z.string(), z.number()]).transform((value) => String(value));
const objectSchema = z.object({ id: idSchema, status: z.string() });
const pageSchema = z.object({
    paging: z.object({ total: z.number().int().nonnegative() }),
    results: z.array(objectSchema)
});

/** Raised when the provider cannot be read or answers something unusable. Never carries a body. */
export class ProviderError extends Error {
    public readonly httpStatus: number;

    public constructor({
        message,
        httpStatus
    }: { readonly message: string; readonly httpStatus: number }) {
        super(message);
        this.name = 'ProviderError';
        this.httpStatus = httpStatus;
    }
}

/** Input of {@link createProviderApi}. */
export interface CreateProviderApiInput {
    /** Bearer token from the operator's session. Never logged, never put in an error. */
    readonly accessToken: string;
    readonly baseUrl?: string;
    readonly fetchImpl?: typeof fetch;
    readonly sleep?: (ms: number) => Promise<void>;
}

function assertSafeId({ id }: { readonly id: string }): void {
    if (!SAFE_ID.test(id)) {
        throw new ProviderError({
            message: 'refusing to call the provider with a malformed id',
            httpStatus: 0
        });
    }
}

/**
 * Builds the provider client over native fetch. GET and PUT here are idempotent, so
 * 429 and 5xx are retried with a short increasing delay. Error messages carry the
 * path and HTTP status only: provider bodies can hold personal data and are dropped.
 *
 * @param input - token and optional injection points (base URL, fetch, sleep)
 * @returns the provider operations the cutover needs
 */
export function createProviderApi({
    accessToken,
    baseUrl = DEFAULT_PROVIDER_BASE_URL,
    fetchImpl = fetch,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
}: CreateProviderApiInput): ProviderApi {
    const request = async ({
        method,
        path,
        body
    }: {
        readonly method: 'GET' | 'PUT';
        readonly path: string;
        readonly body?: Readonly<Record<string, string>>;
    }): Promise<{ readonly httpStatus: number; readonly json: unknown }> => {
        let lastStatus = 0;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
            try {
                const response = await fetchImpl(`${baseUrl}${path}`, {
                    method,
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    body: body === undefined ? undefined : JSON.stringify(body)
                });
                lastStatus = response.status;
                if (!RETRYABLE_STATUS.has(response.status) || attempt === MAX_ATTEMPTS) {
                    const json: unknown = await response.json().catch(() => null);
                    return { httpStatus: response.status, json };
                }
            } catch {
                lastStatus = 0;
                if (attempt === MAX_ATTEMPTS) break;
            }
            await sleep(DEFAULT_RETRY_DELAY_MS * attempt);
        }
        return { httpStatus: lastStatus, json: null };
    };

    return {
        listPage: async ({ kind, offset, limit }): Promise<ListPage> => {
            const path = `${KIND_PATH[kind]}/search?limit=${limit}&offset=${offset}`;
            const { httpStatus, json } = await request({ method: 'GET', path });
            const parsed = pageSchema.safeParse(json);
            if (httpStatus !== 200 || !parsed.success) {
                throw new ProviderError({
                    message: `unusable answer from GET ${KIND_PATH[kind]}/search`,
                    httpStatus
                });
            }
            return { total: parsed.data.paging.total, results: parsed.data.results };
        },
        getById: async ({ kind, id }): Promise<ProviderObject> => {
            assertSafeId({ id });
            const path = `${KIND_PATH[kind]}/${id}`;
            const { httpStatus, json } = await request({ method: 'GET', path });
            const parsed = objectSchema.safeParse(json);
            if (httpStatus !== 200 || !parsed.success) {
                throw new ProviderError({
                    message: `unusable answer from GET ${KIND_PATH[kind]}/${id}`,
                    httpStatus
                });
            }
            return { kind, id: parsed.data.id, status: parsed.data.status };
        },
        cancel: async ({ kind, id }): Promise<CancelCallResult> => {
            assertSafeId({ id });
            const path = `${KIND_PATH[kind]}/${id}`;
            const { httpStatus } = await request({
                method: 'PUT',
                path,
                body: { status: CANCEL_STATUS[kind] }
            });
            return { accepted: httpStatus >= 200 && httpStatus < 300, httpStatus };
        }
    };
}
