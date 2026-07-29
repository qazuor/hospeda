/**
 * SPEC-187 P2-T5 / SPEC-291 Phase 3a — owner-gated richDescription and isVerified tests.
 *
 * The public accommodation payload follows a strict contract:
 * - `richDescription` presence means the OWNING HOST is entitled to publish it (CAN_USE_RICH_DESCRIPTION).
 * - `isVerified` presence (truthy) means the OWNING HOST has the HAS_VERIFICATION_BADGE entitlement.
 * The viewer does NOT decide any of these. Since HOS-353 that is the whole rule:
 * `filterAccommodationByEntitlements` no longer receives the Hono context, and VIDEO
 * moved from viewer-gated to OWNER-gated along with the rest — `CAN_EMBED_VIDEO`
 * ships only in host plans, so asking the reader for it stripped the host's paid
 * video for every ordinary visitor. WhatsApp (HOS-19) is NOT stripped here: the
 * shared-cached public payload carries only the owner-derived `hasWhatsapp` boolean;
 * the number is gated per-viewer on a separate protected endpoint.
 *
 * The Hono app below therefore no longer feeds viewer entitlements to the function
 * under test — it survives only because these cases assert on the JSON response,
 * which needs a `c.json(...)`. See `entitlement-filter.viewer-blind.test.ts` for the
 * structural pin.
 */

import { EntitlementKey } from '@repo/billing';
import { AccommodationPublicSchema } from '@repo/schemas';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { AppBindings } from '../../src/types';
import {
    filterAccommodationByEntitlements,
    stripRichDescriptionFields
} from '../../src/utils/entitlement-filter';

const BASE_ACCOMMODATION = {
    id: 'acc-001',
    description: 'Plain description',
    richDescription: '## Premium\n\n**luxury**',
    // SPEC-212 sibling of richDescription. Gated by the SAME owner entitlement:
    // the web transform prefers this field over the plain one when resolving the
    // visitor's locale, so leaving it ungated fully bypasses the richDescription gate.
    richDescriptionI18n: {
        es: '## Premium ES\n\n**lujo**',
        en: '## Premium EN\n\n**luxury**',
        pt: '## Premium PT\n\n**luxo**'
    },
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
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION, []);
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
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION, [
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
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.richDescription).toBe('## Premium\n\n**luxury**');
        expect(body.isVerified).toBe(true);
    });

    it('strips video when the OWNER lacks CAN_EMBED_VIDEO, and never emits the WhatsApp number (HOS-19: only hasWhatsapp)', async () => {
        const app = createViewerContext([]);

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION, [
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
        // HOS-19: the number is never stripped/emitted here. Only the owner-derived
        // boolean is set, and it is TRUE regardless of who is reading — which is what
        // makes it safe to compute into a shared-cached payload.
        expect(body.hasWhatsapp).toBe(true);
        expect(body.whatsappNumber).toBeUndefined();
    });

    it('sets hasWhatsapp=false when the accommodation has no contactInfo.whatsapp', async () => {
        const app = createViewerContext([EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY]);

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(
                { id: 'acc-002', contactInfo: { whatsapp: null } },
                []
            );
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.hasWhatsapp).toBe(false);
    });

    it.each([
        ['a number', 5493442123456],
        ['an object', { value: '+549' }],
        ['an array', ['+549']],
        ['a boolean', true]
    ])('still strips the premium fields when contactInfo.whatsapp is %s (fail-open regression)', async (_label, whatsapp) => {
        // REGRESSION. `contactInfo` is an unvalidated JSONB blob, so a legacy
        // non-string `whatsapp` used to make `.trim` undefined and throw — and this
        // function's catch is fail-OPEN, returning the payload with the premium
        // fields intact. The gate was therefore defeated by a malformed value in an
        // unrelated column. Asserting the STRIP here, not just `hasWhatsapp`, is the
        // point: `hasWhatsapp` alone would pass even if the throw resurfaced.
        const app = createViewerContext();

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(
                {
                    ...BASE_ACCOMMODATION,
                    contactInfo: { whatsapp } as unknown as { whatsapp?: string | null }
                },
                []
            );
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.richDescription).toBeUndefined();
        expect(body.richDescriptionI18n).toBeUndefined();
        expect(body.hasWhatsapp).toBe(false);
    });

    it('sets hasWhatsapp=false for a whitespace-only number (consistent with the /whatsapp endpoint trim)', async () => {
        // A legacy whitespace-only value must NOT flip hasWhatsapp true, otherwise
        // the web would surface a misleading upsell for a listing with no real number.
        const app = createViewerContext([EntitlementKey.CAN_CONTACT_WHATSAPP_DISPLAY]);

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(
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
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION, [
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
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION, [
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
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION, [
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

    // -------------------------------------------------------------------------
    // richDescriptionI18n — the SPEC-212 sibling must follow the SAME owner gate
    // -------------------------------------------------------------------------

    it('omits richDescriptionI18n when ownerEntitlements do not include CAN_USE_RICH_DESCRIPTION', async () => {
        const app = createViewerContext([EntitlementKey.CAN_USE_RICH_DESCRIPTION]);

        app.get('/', (c) => {
            // owner does NOT have CAN_USE_RICH_DESCRIPTION
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION, []);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.richDescriptionI18n).toBeUndefined();
    });

    it('strips BOTH rich fields together — an ungated i18n sibling fully bypasses the richDescription gate', async () => {
        // This is the production bug: `richDescription` was correctly stripped while
        // `richDescriptionI18n` survived. The web transform prefers the i18n value over
        // the plain one (apps/web/src/lib/api/transforms.ts), so the premium markdown was
        // still rendered as HTML on the public detail page for a non-entitled owner.
        const app = createViewerContext();

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION, [
                EntitlementKey.HAS_VERIFICATION_BADGE
            ]);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.richDescription).toBeUndefined();
        expect(body.richDescriptionI18n).toBeUndefined();
    });

    it('preserves richDescriptionI18n when ownerEntitlements include CAN_USE_RICH_DESCRIPTION', async () => {
        const app = createViewerContext();

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION, [
                EntitlementKey.CAN_USE_RICH_DESCRIPTION,
                EntitlementKey.HAS_VERIFICATION_BADGE
            ]);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        // Absolute literals on purpose: deriving them from the fixture would make the
        // VALUE assertion vacuous and only the presence/absence edges would survive.
        expect(body.richDescriptionI18n).toEqual({
            es: '## Premium ES\n\n**lujo**',
            en: '## Premium EN\n\n**luxury**',
            pt: '## Premium PT\n\n**luxo**'
        });
    });

    it('returns richDescriptionI18n raw when ownerEntitlements parameter is omitted (admin/internal call sites)', async () => {
        const app = createViewerContext();

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION);
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(body.richDescriptionI18n).toEqual({
            es: '## Premium ES\n\n**lujo**',
            en: '## Premium EN\n\n**luxury**',
            pt: '## Premium PT\n\n**luxo**'
        });
    });

    it('DELETES the gated keys even when their stored value is null (the column default)', async () => {
        // The deletes must not be guarded on truthiness. `rich_description` defaults to
        // NULL, so a guarded delete would leave the KEY present on a gated
        // accommodation — and `'richDescription' in payload` being false is the whole
        // reason this gate uses `delete` instead of `= undefined`. An earlier revision
        // guarded them and this case is what exposes it; the fixture elsewhere in this
        // file is truthy and cannot.
        const app = createViewerContext();
        let captured: Record<string, unknown> | null = null;

        app.get('/', (c) => {
            captured = filterAccommodationByEntitlements(
                { id: 'acc-null', richDescription: null, richDescriptionI18n: null },
                []
            ) as Record<string, unknown>;
            return c.json({ ok: true });
        });

        await app.request('/');

        expect('richDescription' in (captured ?? {})).toBe(false);
        expect('richDescriptionI18n' in (captured ?? {})).toBe(false);
    });

    it('contains a throw from a malformed media blob without leaking the premium fields', async () => {
        // `media` is unvalidated JSONB. A null element makes the video-strip callback
        // dereference `.type` on null and throw, landing in the catch — which used to
        // return the payload as-is. The gate must survive that, and the request must
        // still answer 200 rather than 500.
        const app = createViewerContext();

        app.get('/', (c) => {
            const filtered = filterAccommodationByEntitlements(
                { ...BASE_ACCOMMODATION, media: [null] as unknown as unknown[] },
                []
            );
            return c.json(filtered);
        });

        const res = await app.request('/');
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.richDescription).toBeUndefined();
        expect(body.richDescriptionI18n).toBeUndefined();
    });

    it('DELETES the gated keys rather than setting them to undefined', async () => {
        // Asserting on the pre-serialization object, on purpose. Every other test here
        // goes through `c.json()` → `res.json()`, and JSON.stringify drops
        // undefined-valued keys and absent keys identically — so those assertions pass
        // just as well against `= undefined`, which leaves the key present for anything
        // that inspects the object (`in`, Object.keys, structuredClone, an in-process
        // cache). This is the only test that can tell the two apart.
        const app = createViewerContext();
        let captured: Record<string, unknown> | null = null;

        app.get('/', (c) => {
            captured = filterAccommodationByEntitlements(BASE_ACCOMMODATION, []) as Record<
                string,
                unknown
            >;
            return c.json({ ok: true });
        });

        await app.request('/');

        expect(captured).not.toBeNull();
        expect('richDescription' in (captured ?? {})).toBe(false);
        expect('richDescriptionI18n' in (captured ?? {})).toBe(false);
        // videoUrl is owner-gated too (HOS-353) and follows the same delete rule.
        expect('videoUrl' in (captured ?? {})).toBe(false);
    });

    it('non-vacuity guard: richDescriptionI18n IS part of the public response contract', () => {
        // If this ever fails, the field was removed from the public schema and the
        // gating tests above stop protecting anything real — they would pass trivially.
        expect(Object.keys(AccommodationPublicSchema.shape)).toContain('richDescriptionI18n');
        expect(Object.keys(AccommodationPublicSchema.shape)).toContain('richDescription');
    });

    it('richDescription behaviour is unchanged (regression): owner-gate still works', async () => {
        const app = createViewerContext([EntitlementKey.CAN_USE_RICH_DESCRIPTION]);

        app.get('/', (c) => {
            // owner does NOT have CAN_USE_RICH_DESCRIPTION
            const filtered = filterAccommodationByEntitlements(BASE_ACCOMMODATION, [
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

describe('stripRichDescriptionFields', () => {
    it('removes BOTH rich-description keys from a single accommodation object', () => {
        const stripped = stripRichDescriptionFields({
            id: 'acc-100',
            name: 'Lodge',
            richDescription: '## Premium',
            richDescriptionI18n: { es: 'a', en: 'b', pt: 'c' }
        }) as Record<string, unknown>;

        expect('richDescription' in stripped).toBe(false);
        expect('richDescriptionI18n' in stripped).toBe(false);
    });

    it('leaves every other key untouched', () => {
        const stripped = stripRichDescriptionFields({
            id: 'acc-100',
            name: 'Lodge',
            summary: 'A summary',
            richDescription: '## Premium'
        }) as Record<string, unknown>;

        expect(stripped).toEqual({ id: 'acc-100', name: 'Lodge', summary: 'A summary' });
    });

    it('is a no-op on an object carrying neither field', () => {
        const stripped = stripRichDescriptionFields({ id: 'acc-100' }) as Record<string, unknown>;
        expect(stripped).toEqual({ id: 'acc-100' });
    });

    it('throws a TypeError when handed an ARRAY instead of a single row', () => {
        // Nearly every call site is `xs.map(stripRichDescriptionFields)`. Dropping the
        // `.map` is a one-character mistake that the `T extends object` constraint does
        // not catch, and object-spreading an array silently yields `{0: …, 1: …}` —
        // a corrupted payload failing far away as an opaque schema error.
        expect(() =>
            stripRichDescriptionFields([{ id: 'acc-100' }] as unknown as Record<string, unknown>)
        ).toThrow(TypeError);
    });

    it('the array guard names the likely mistake', () => {
        expect(() => stripRichDescriptionFields([] as unknown as Record<string, unknown>)).toThrow(
            /\.map\(stripRichDescriptionFields\)/
        );
    });
});
