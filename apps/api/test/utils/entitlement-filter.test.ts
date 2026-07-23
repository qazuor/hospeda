/**
 * SPEC-187 P2-T5 / SPEC-291 Phase 3a — owner-gated richDescription and isVerified tests.
 *
 * The public accommodation payload follows a strict contract:
 * - `richDescription` presence means the OWNING HOST is entitled to publish it (CAN_USE_RICH_DESCRIPTION).
 * - `isVerified` presence (truthy) means the OWNING HOST has the HAS_VERIFICATION_BADGE entitlement.
 * The viewer does NOT decide these owner-gated fields. Video is still viewer-gated
 * via `hasEntitlement(c, CAN_EMBED_VIDEO)`. WhatsApp (HOS-19) is NO LONGER stripped
 * here: the shared-cached public payload only carries the owner-derived `hasWhatsapp`
 * boolean (derived from `contactInfo.whatsapp`); the number is gated per-viewer on a
 * separate protected endpoint.
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
    contactInfo: { whatsapp: '+5493442123456' },
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

    it('keeps video viewer-gated but never emits the WhatsApp number (HOS-19: only hasWhatsapp)', async () => {
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
        // HOS-19: the number is never stripped/emitted here — it is not the
        // viewer-gated surface. Only the owner-derived boolean is set, and it is
        // TRUE regardless of the viewer's plan (cache-safe).
        expect(body.hasWhatsapp).toBe(true);
        expect(body.whatsappNumber).toBeUndefined();
    });

    it('sets hasWhatsapp=false when the accommodation has no contactInfo.whatsapp', async () => {
        const app = createViewerContext([EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY]);

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(
                c,
                { id: 'acc-002', contactInfo: { whatsapp: null } },
                []
            );
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.hasWhatsapp).toBe(false);
    });

    it('sets hasWhatsapp=false for a whitespace-only number (consistent with the /whatsapp endpoint trim)', async () => {
        // A legacy whitespace-only value must NOT flip hasWhatsapp true, otherwise
        // the web would surface a misleading upsell for a listing with no real number.
        const app = createViewerContext([EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY]);

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(
                c,
                { id: 'acc-003', contactInfo: { whatsapp: '   ' } },
                []
            );
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.hasWhatsapp).toBe(false);
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
