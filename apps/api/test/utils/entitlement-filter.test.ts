/**
 * SPEC-187 P2-T5 — owner-gated richDescription omission tests.
 *
 * The public accommodation payload now follows a strict contract:
 * `richDescription` presence means the OWNING HOST is entitled to publish it.
 * The viewer does NOT decide this field. Viewer-gated branches (video,
 * WhatsApp, verification badge) remain unchanged and still depend on
 * `hasEntitlement(c, ...)` / `userEntitlements`.
 */

import { EntitlementKey } from '@repo/billing';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppBindings } from '../../src/types';
import { filterAccommodationByEntitlements } from '../../src/utils/entitlement-filter';

const BASE_ACCOMMODATION = {
    id: 'acc-001',
    description: 'Plain description',
    richDescription: '## Premium\n\n**luxury**',
    videoUrl: 'https://youtube.com/watch?v=demo',
    whatsappNumber: '+5493442123456',
    whatsappDirectLink: true,
    enableWhatsAppDirect: true,
    verificationBadge: true,
    media: [{ type: 'video', url: 'https://youtube.com/watch?v=demo' }]
} as const;

function createViewerContext(viewerEntitlements: EntitlementKey[] = []) {
    const app = new Hono<AppBindings>();
    app.use('*', async (c, next) => {
        c.set('userEntitlements', new Set(viewerEntitlements));
        c.set('ownerEntitlements', new Set<EntitlementKey>());
        await next();
    });
    return app;
}

describe('filterAccommodationByEntitlements', () => {
    it('omits richDescription when ownerEntitlements do not include CAN_USE_RICH_DESCRIPTION', async () => {
        const app = createViewerContext([
            EntitlementKey.CAN_EMBED_VIDEO,
            EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY,
            EntitlementKey.CAN_CONTACT_WHATSAPP_DIRECT,
            EntitlementKey.HAS_VERIFICATION_BADGE,
            // viewer DOES have rich-description entitlement, but that must NOT matter anymore
            EntitlementKey.CAN_USE_RICH_DESCRIPTION
        ]);

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(c, BASE_ACCOMMODATION, []);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.richDescription).toBeUndefined();
        // Regression: plain description is NOT stripped anymore.
        expect(body.description).toBe('Plain description');
    });

    it('preserves richDescription when ownerEntitlements include CAN_USE_RICH_DESCRIPTION', async () => {
        const app = createViewerContext();

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(c, BASE_ACCOMMODATION, [
                EntitlementKey.CAN_USE_RICH_DESCRIPTION
            ]);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.richDescription).toBe('## Premium\n\n**luxury**');
    });

    it('returns richDescription raw when ownerEntitlements parameter is omitted (admin/non-owner-gated call sites)', async () => {
        const app = createViewerContext();

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(c, BASE_ACCOMMODATION);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.richDescription).toBe('## Premium\n\n**luxury**');
    });

    it('keeps viewer-gated branches unchanged for video, WhatsApp, and verification badge', async () => {
        const app = createViewerContext([]);

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(c, BASE_ACCOMMODATION, [
                EntitlementKey.CAN_USE_RICH_DESCRIPTION
            ]);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.richDescription).toBe('## Premium\n\n**luxury**');
        expect(body.videoUrl).toBeUndefined();
        expect(body.media).toEqual([]);
        expect(body.whatsappNumber).toBeUndefined();
        expect(body.whatsappDirectLink).toBe(false);
        expect(body.enableWhatsAppDirect).toBe(false);
        expect(body.verificationBadge).toBe(false);
    });
});
