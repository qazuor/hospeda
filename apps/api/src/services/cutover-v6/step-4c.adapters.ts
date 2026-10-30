import type { RevalidationService } from '@repo/service-core';
import { MAX_PURGE_OPERATIONS_PER_REQUEST } from './step-4c.legacy.js';
import type { PagePurger } from './step-4c.service.js';

/** Sends one prefix-purge request to the web `/api/revalidate/` endpoint. Never throws. */
export type PrefixPurgeTransport = (input: {
    readonly prefixes: readonly string[];
}) => Promise<{ readonly ok: boolean; readonly status: number }>;

/**
 * Builds the prefix transport: `POST ${siteUrl}/api/revalidate/?secret=...` with
 * `{ prefixes }`. The response BODY is the verdict, as in the tag adapter: a 2xx
 * without `ok: true` is a purge that did not happen. A thrown fetch error (or
 * timeout) is reported as status 0.
 */
export function createPrefixPurgeTransport({
    siteUrl,
    secret,
    fetchImpl = fetch
}: {
    readonly siteUrl: string;
    readonly secret: string;
    readonly fetchImpl?: typeof fetch;
}): PrefixPurgeTransport {
    const url = `${siteUrl.replace(/\/$/, '')}/api/revalidate/?secret=${encodeURIComponent(secret)}`;
    return async ({ prefixes }) => {
        try {
            const response = await fetchImpl(url, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ prefixes }),
                signal: AbortSignal.timeout(15_000)
            });
            if (!response.ok) return { ok: false, status: response.status };
            const body = (await response.json().catch(() => null)) as { ok?: unknown } | null;
            return { ok: body?.ok === true, status: response.status };
        } catch {
            return { ok: false, status: 0 };
        }
    };
}
/** Raised when step 4c would report a purge from a no-op service adapter. */
export class Step4cNoOpAdapterError extends Error {
    constructor() {
        super('Step 4c refuses to run with NoOpRevalidationAdapter.');
        this.name = 'Step4cNoOpAdapterError';
    }
}

/** Adapts the application revalidation service to the step 4c purge port. */
export function createRevalidationPagePurger({
    service,
    prefixTransport
}: {
    readonly service: RevalidationService;
    readonly prefixTransport: PrefixPurgeTransport;
}): PagePurger {
    if (service.getAdapterName() === 'NoOpRevalidationAdapter') {
        throw new Step4cNoOpAdapterError();
    }
    return {
        async purge({ tags }) {
            const results = await service.revalidateTags({
                tags,
                triggeredBy: 'system',
                trigger: 'manual',
                reason: 'cutover step 4c',
                entityType: 'cutover'
            });
            if (results.length === 0) return { ok: false, failed: tags };
            const failed = results.flatMap((result, index) =>
                result.success ? [] : [tags[index] ?? result.target]
            );
            return { ok: failed.length === 0, failed };
        },
        async purgePrefixes({ prefixes }) {
            const failed: string[] = [];
            for (let i = 0; i < prefixes.length; i += MAX_PURGE_OPERATIONS_PER_REQUEST) {
                const chunk = prefixes.slice(i, i + MAX_PURGE_OPERATIONS_PER_REQUEST);
                const result = await prefixTransport({ prefixes: chunk });
                if (!result.ok) failed.push(...chunk);
            }
            return { ok: failed.length === 0 && prefixes.length > 0, failed };
        }
    };
}
