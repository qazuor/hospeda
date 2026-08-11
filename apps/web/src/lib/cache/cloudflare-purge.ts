/**
 * @file cache/cloudflare-purge.ts
 * @description The one place that talks to Cloudflare's purge API (HOS-427).
 *
 * Extracted from `pages/api/revalidate.ts`, which owned this inline until a
 * second caller appeared: the deploy purge in `./purge-on-deploy.ts`. The two
 * MUST share it. The dangerous half of this contract is not building the URL —
 * it is knowing that a Cloudflare `200` can mean failure (see
 * {@link purgeCloudflare}), and a second hand-rolled copy that forgot the
 * envelope check would report success while evicting nothing.
 *
 * A NOTE ON BLAST RADIUS, because two things in this codebase share a name and
 * do opposite things:
 *
 *   - `{ kind: 'tags', tags: ['prod:all'] }` purges ONE environment. This is
 *     what a deploy wants.
 *   - `{ kind: 'everything' }` sends Cloudflare `purge_everything`, which flushes
 *     the WHOLE ZONE — and `staging.hospeda.com.ar` and `hospeda.com.ar` are the
 *     same zone, so triggering it from staging empties production.
 *
 * Cloudflare has no zone-scoped variant of `purge_everything`; the namespaced
 * catch-all tag IS the scoping mechanism. `everything` exists here only because
 * `/api/revalidate` exposes it as a deliberate operator escape hatch. Nothing
 * automated should reach for it.
 *
 * This module deliberately does NOT catch network errors: it preserves the
 * throwing behaviour `revalidate.ts` had before the extraction, so that endpoint's
 * observable responses are unchanged. Callers that must not throw — the deploy
 * purge is one — wrap it themselves.
 */

/** What to purge. */
export type CloudflarePurgeInstruction =
    | { readonly kind: 'tags'; readonly tags: readonly string[] }
    | { readonly kind: 'everything' };

/** The verdict of one purge attempt. */
export type CloudflarePurgeOutcome =
    | { readonly ok: true }
    /** Cloudflare answered non-2xx. */
    | {
          readonly ok: false;
          readonly kind: 'http';
          readonly status: number;
          readonly detail: string;
      }
    /** Cloudflare answered 2xx but the envelope said the purge did not happen. */
    | {
          readonly ok: false;
          readonly kind: 'rejected';
          readonly status: number;
          readonly detail: unknown;
      };

/** Cloudflare credentials, present only where they are actually configured. */
export interface CloudflareCredentials {
    readonly zoneId: string;
    readonly apiToken: string;
}

/**
 * The v4 purge endpoint for a zone.
 *
 * @param params.zoneId - The Cloudflare zone.
 * @returns The absolute endpoint URL.
 */
export function buildCloudflarePurgeEndpoint({ zoneId }: { readonly zoneId: string }): string {
    return `https://api.cloudflare.com/client/v4/zones/${zoneId}/purge_cache`;
}

/**
 * Read the Cloudflare credentials straight from `process.env`.
 *
 * Deliberately NOT routed through `lib/env.ts`'s validated accessor, for the
 * reason documented at length in `./cache-tag-environment.ts`: that accessor
 * parses the WHOLE schema and throws on the first problem anywhere in it, so an
 * unrelated misconfiguration would silently disable this subsystem.
 *
 * @returns Both credentials, or `null` when either is missing.
 */
export function readCloudflareCredentials(): CloudflareCredentials | null {
    if (typeof process === 'undefined' || !process.env) return null;

    const zoneId = process.env.CLOUDFLARE_ZONE_ID;
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;

    if (!zoneId || !apiToken) return null;
    return { zoneId, apiToken };
}

/**
 * Issue one purge request to Cloudflare.
 *
 * A 2xx status is NOT proof the purge happened. Cloudflare's v4 API answers with
 * an envelope — `{ success, errors[], result }` — and returns `success: false`
 * on a `200` for several validation and entitlement failures. Trusting the
 * status line alone would report a purge that evicted nothing as a success, log
 * it as a success, and leave the content stale for its whole TTL. That check is
 * the main reason this function exists in one place instead of two.
 *
 * Throws on network failure rather than returning an outcome, preserving the
 * pre-extraction behaviour of `pages/api/revalidate.ts`.
 *
 * @param params.zoneId - The Cloudflare zone.
 * @param params.apiToken - A token with cache-purge permission on that zone.
 * @param params.instruction - What to purge.
 * @returns The outcome of the attempt.
 */
export async function purgeCloudflare({
    zoneId,
    apiToken,
    instruction
}: {
    readonly zoneId: string;
    readonly apiToken: string;
    readonly instruction: CloudflarePurgeInstruction;
}): Promise<CloudflarePurgeOutcome> {
    const body =
        instruction.kind === 'everything' ? { purge_everything: true } : { tags: instruction.tags };

    const response = await fetch(buildCloudflarePurgeEndpoint({ zoneId }), {
        method: 'POST',
        headers: {
            authorization: `Bearer ${apiToken}`,
            'content-type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '<no body>');
        return { ok: false, kind: 'http', status: response.status, detail };
    }

    const envelope = (await response.json().catch(() => null)) as {
        success?: unknown;
        errors?: unknown;
    } | null;

    if (envelope === null || envelope.success !== true) {
        return {
            ok: false,
            kind: 'rejected',
            status: response.status,
            detail: envelope?.errors ?? '<unparseable response body>'
        };
    }

    return { ok: true };
}
