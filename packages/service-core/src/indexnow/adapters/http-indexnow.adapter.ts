/**
 * @fileoverview
 * HTTP IndexNow adapter — posts changed entities to the web app (HOS-585 G-1).
 *
 * This adapter does NOT talk to `api.indexnow.org`. It hands the changed
 * entities to the web app's `/api/indexnow/` endpoint, which owns the key file,
 * the public-URL map and the actual protocol call. Same division of labour as
 * `CloudflareRevalidationAdapter`, and for the same reason: the credentials and
 * the URL vocabulary for the public site live on the web side.
 */

import { createLogger } from '@repo/logger';
import type {
    IndexNowAdapter,
    IndexNowNotifyResult,
    NotifiableEntity
} from './indexnow.adapter.js';

const logger = createLogger('http-indexnow-adapter');

/** How long to wait for the web app before giving up. */
const REQUEST_TIMEOUT_MS = 15_000;

/** Configuration for {@link HttpIndexNowAdapter}. */
export interface HttpIndexNowAdapterConfig {
    /** Shared secret, matching `HOSPEDA_REVALIDATION_SECRET` on the web app. */
    readonly secret: string;
    /** Base site URL, e.g. `https://hospeda.com.ar`. */
    readonly siteUrl: string;
}

/** Adapter that forwards notifications to the web app's endpoint. */
export class HttpIndexNowAdapter implements IndexNowAdapter {
    readonly name = 'http';

    private readonly secret: string;
    private readonly siteUrl: string;

    constructor(config: HttpIndexNowAdapterConfig) {
        this.secret = config.secret;
        this.siteUrl = config.siteUrl.replace(/\/$/, '');
    }

    /**
     * POST the changed entities to the web app.
     *
     * @param params.entities - The changed entities. Empty is a no-op.
     * @returns The outcome. Never rejects.
     */
    async notify(params: {
        readonly entities: ReadonlyArray<NotifiableEntity>;
    }): Promise<IndexNowNotifyResult> {
        const startedAt = Date.now();
        const { entities } = params;

        if (entities.length === 0) {
            return { success: true, submitted: 0, durationMs: 0 };
        }

        // The trailing slash is REQUIRED. The web app enforces its own
        // trailing-slash redirect, so Astro 301-redirects `/api/indexnow` →
        // `/api/indexnow/`, and a POST following a 301 is downgraded to GET —
        // the notification would silently become a no-op that still looks like
        // a 2xx. Same footgun already documented on the revalidation adapter.
        const url = `${this.siteUrl}/api/indexnow/?secret=${encodeURIComponent(this.secret)}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entities }),
                signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
            });

            const bodyText = await response.text();

            if (!response.ok) {
                const error = `HTTP ${response.status} from the notification endpoint: ${bodyText.slice(0, 300)}`;
                logger.warn(error);
                return { success: false, submitted: 0, error, durationMs: Date.now() - startedAt };
            }

            // A 2xx alone is not the verdict — the endpoint reports how many
            // URLs actually went out, and zero means nothing was notified even
            // though the call "succeeded".
            let submitted = 0;
            try {
                const parsed = JSON.parse(bodyText) as { submitted?: unknown };
                submitted = typeof parsed.submitted === 'number' ? parsed.submitted : 0;
            } catch {
                // Body was not JSON; treat as zero rather than inventing a count.
            }

            return { success: true, submitted, durationMs: Date.now() - startedAt };
        } catch (error) {
            const reason = error instanceof Error ? error.message : String(error);
            logger.warn(`IndexNow notification failed before a response: ${reason}`);
            return {
                success: false,
                submitted: 0,
                error: reason,
                durationMs: Date.now() - startedAt
            };
        }
    }
}
