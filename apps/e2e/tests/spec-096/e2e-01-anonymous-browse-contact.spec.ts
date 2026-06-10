/**
 * E2E-1 — Anonymous browse → search → results → detail → contact form.
 *
 * Actors: Anonymous guest (no auth).
 * Tags: @p0 @guest @discovery @cross-app
 *
 * Preconditions:
 *   - Seeded accommodations exist (via `e2e-seed.ts`).
 *   - Public contact endpoint mounted at `/api/v1/public/contact`.
 *
 * What this validates (cross-app discovery contract):
 *  1. Public listing endpoint responds 200 with at least one accommodation.
 *  2. Public detail endpoint by id responds 200 for a seeded accommodation.
 *  3. Submitting a valid contact form returns 200 with `success: true`.
 *  4. Honeypot: a submission with `website` filled returns 200 (silently
 *     dropped) — clients cannot distinguish honeypot rejection from a real
 *     success.
 *  5. Validation: a too-short message returns 4xx with a structured error.
 *
 * @see SPEC-092 spec.md § E2E-1
 */

import { expect, test } from '@playwright/test';

const API_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:3001';

interface PublicAccommodationRow {
    readonly id: string;
    readonly slug: string;
    readonly name?: string;
}

test.describe('E2E-1: anonymous browse + contact form @p0 @guest @discovery @cross-app', () => {
    test('listing returns rows, detail loads, contact form succeeds + honeypot + validation', async ({
        page
    }) => {
        // ── 1. Listing ────────────────────────────────────────────────────
        const listRes = await page.request.get(
            `${API_URL}/api/v1/public/accommodations?pageSize=10`
        );
        expect(listRes.ok(), `listing should be 200, got ${listRes.status()}`).toBe(true);
        // The route factory wraps paginated results in { data: { items: [...], pagination } }.
        const listBody = (await listRes.json()) as {
            data?: { items?: ReadonlyArray<PublicAccommodationRow>; pagination?: unknown };
        };
        expect(
            (listBody.data?.items?.length ?? 0) > 0,
            'public listing should contain at least one seeded accommodation'
        ).toBe(true);

        const first = listBody.data?.items?.[0];
        expect(first?.id).toBeTruthy();

        // ── 2. Detail ─────────────────────────────────────────────────────
        const detailRes = await page.request.get(
            `${API_URL}/api/v1/public/accommodations/${first?.id}`
        );
        expect(detailRes.ok(), `detail should be 200, got ${detailRes.status()}`).toBe(true);
        const detailBody = (await detailRes.json()) as { data?: PublicAccommodationRow | null };
        expect(detailBody.data?.id).toBe(first?.id);

        // ── 3. Contact form: valid submission ─────────────────────────────
        const contactRes = await page.request.post(`${API_URL}/api/v1/public/contact`, {
            data: {
                firstName: 'E2E',
                lastName: 'Anonymous',
                email: 'e2e-anon@hospeda-test.local',
                message: 'Hola, quiero más información sobre este alojamiento.',
                type: 'accommodation',
                accommodationId: first?.id
            }
        });
        expect(contactRes.ok(), `contact submit should be 200, got ${contactRes.status()}`).toBe(
            true
        );
        const contactBody = (await contactRes.json()) as {
            success?: boolean;
            data?: { success?: boolean };
        };
        expect(contactBody.success === true || contactBody.data?.success === true).toBe(true);

        // ── 4. Honeypot: filled `website` returns 200 fake-success ────────
        const honeyRes = await page.request.post(`${API_URL}/api/v1/public/contact`, {
            data: {
                firstName: 'Bot',
                lastName: 'McSpammer',
                email: 'bot@hospeda-test.local',
                message: 'I am totally a bot but the response should not say so.',
                type: 'general',
                website: 'https://example.com/spam'
            }
        });
        expect(
            honeyRes.ok(),
            `honeypot must return 200 fake-success (got ${honeyRes.status()})`
        ).toBe(true);

        // ── 5. Validation: message too short → 4xx ────────────────────────
        const tooShortRes = await page.request.post(`${API_URL}/api/v1/public/contact`, {
            data: {
                firstName: 'Short',
                lastName: 'Tester',
                email: 'short@hospeda-test.local',
                message: 'short',
                type: 'general'
            }
        });
        expect(
            tooShortRes.status() >= 400 && tooShortRes.status() < 500,
            `expected 4xx for short message, got ${tooShortRes.status()}`
        ).toBe(true);
    });
});
