/**
 * @file [key].txt.ts
 * @description Serves the IndexNow key-ownership file (HOS-585 G-1, OQ-2).
 *
 * IndexNow proves you control a host by asking you to serve a file named after
 * the key, containing the key, at the host's root. `pages/api/indexnow.ts`
 * declares this URL as `keyLocation` on every submission; if it does not answer
 * with the exact key, every submission is rejected.
 *
 * **A dynamic route rather than a file in `public/` (OQ-2, decided 17/08).**
 * The filename IS the key, so a `public/` file bakes the key into the build:
 * rotating it would mean a commit, a review and a deploy of the web app, and
 * the key would live in git forever. Reading `HOSPEDA_INDEXNOW_KEY` per request
 * makes rotation an environment-variable change on Coolify and nothing else,
 * which is the whole reason the key is an env var in the first place.
 *
 * **The key is not a secret.** It is published at a public URL by design — the
 * protocol requires anyone to be able to fetch it. So the comparison below is a
 * plain one: there is no secret to leak through its timing. What the comparison
 * does protect is the "does this host have IndexNow configured?" answer, which
 * is why a mismatch is a bare 404 rather than a message.
 *
 * Static sibling routes (`robots.txt`, `llms.txt`) take precedence over this
 * dynamic one in Astro's routing, so they are unaffected.
 *
 * @route GET /<key>.txt
 */

import type { APIRoute } from 'astro';
import { getIndexNowKey } from '@/lib/env';

export const prerender = false;

/** 404 with no body: an unconfigured host and a wrong key look identical. */
function notFound(): Response {
    return new Response(null, { status: 404 });
}

export const GET: APIRoute = ({ params }) => {
    const configuredKey = getIndexNowKey();
    if (!configuredKey) return notFound();

    if (params.key !== configuredKey) return notFound();

    return new Response(configuredKey, {
        status: 200,
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            // Deliberately NOT shared-cacheable, and not an oversight the
            // HOS-369 W1-1 guard should be exempted from. There is no cache tag
            // that could purge this: a rotation changes the URL itself, so the
            // edge could hold a 404 for the NEW key file — and a 404 here makes
            // IndexNow reject every submission until the TTL runs out, silently.
            // The traffic is a handful of verifier fetches, so the trade is free.
            'Cache-Control': 'no-store'
        }
    });
};
