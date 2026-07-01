/**
 * SPEC-187 P2-T5 / SPEC-291 Phase 3a — owner-gated richDescription and isVerified tests.
 *
 * The public accommodation payload follows a strict contract:
 * - `richDescription` presence means the OWNING HOST is entitled to publish it (CAN_USE_RICH_DESCRIPTION).
 * - `isVerified` presence (truthy) means the OWNING HOST has the HAS_VERIFICATION_BADGE entitlement.
 * The viewer does NOT decide these owner-gated fields. Viewer-gated branches (video,
 * WhatsApp) still depend on `hasEntitlement(c, ...)` / `userEntitlements`.
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
    isVerified: true,
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
                EntitlementKey.CAN_USE_RICH_DESCRIPTION,
                EntitlementKey.HAS_VERIFICATION_BADGE
            ]);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.richDescription).toBe('## Premium\n\n**luxury**');
    });

    it('returns richDescription and isVerified raw when ownerEntitlements parameter is omitted (admin/internal call sites)', async () => {
        const app = createViewerContext();

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(c, BASE_ACCOMMODATION);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.richDescription).toBe('## Premium\n\n**luxury**');
        expect(body.isVerified).toBe(true);
    });

    it('keeps viewer-gated branches (video, WhatsApp) stripped when viewer lacks entitlements', async () => {
        const app = createViewerContext([]);

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(c, BASE_ACCOMMODATION, [
                EntitlementKey.CAN_USE_RICH_DESCRIPTION,
                EntitlementKey.HAS_VERIFICATION_BADGE
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
    });

    // -------------------------------------------------------------------------
    // SPEC-291 Phase 3a: owner-gated isVerified tests
    // -------------------------------------------------------------------------

    it('forces isVerified=false when owner lacks HAS_VERIFICATION_BADGE', async () => {
        const app = createViewerContext();

        app.get('/', (c) => {
            // ownerEntitlements provided but WITHOUT HAS_VERIFICATION_BADGE
            const filtered = filterAccommodationByEntitlements(c, BASE_ACCOMMODATION, [
                EntitlementKey.CAN_USE_RICH_DESCRIPTION
                // HAS_VERIFICATION_BADGE intentionally omitted
            ]);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.isVerified).toBe(false);
    });

    it('preserves isVerified=true when owner has HAS_VERIFICATION_BADGE', async () => {
        const app = createViewerContext();

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(c, BASE_ACCOMMODATION, [
                EntitlementKey.CAN_USE_RICH_DESCRIPTION,
                EntitlementKey.HAS_VERIFICATION_BADGE
            ]);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.isVerified).toBe(true);
    });

    it('does NOT consult the VIEWER entitlement for isVerified (viewer with HAS_VERIFICATION_BADGE, owner without)', async () => {
        // Viewer has HAS_VERIFICATION_BADGE — must NOT unlock isVerified if the owner lacks it
        const app = createViewerContext([EntitlementKey.HAS_VERIFICATION_BADGE]);

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(c, BASE_ACCOMMODATION, [
                // owner entitlements: does NOT include HAS_VERIFICATION_BADGE
                EntitlementKey.CAN_USE_RICH_DESCRIPTION
            ]);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        // isVerified must still be forced false because the OWNER lacks the entitlement
        expect(body.isVerified).toBe(false);
    });

    it('richDescription behaviour is unchanged (regression): owner-gate still works', async () => {
        const app = createViewerContext([EntitlementKey.CAN_USE_RICH_DESCRIPTION]);

        app.get('/', (c) => {
            // owner does NOT have CAN_USE_RICH_DESCRIPTION
            const filtered = filterAccommodationByEntitlements(c, BASE_ACCOMMODATION, [
                EntitlementKey.HAS_VERIFICATION_BADGE
            ]);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        // richDescription stripped because owner lacks CAN_USE_RICH_DESCRIPTION,
        // regardless of viewer having it
        expect(body.richDescription).toBeUndefined();
        // isVerified preserved because owner has HAS_VERIFICATION_BADGE
        expect(body.isVerified).toBe(true);
    });
});
