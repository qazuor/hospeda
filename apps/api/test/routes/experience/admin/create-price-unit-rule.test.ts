/**
 * `POST /api/v1/admin/experiences` — the one route HOS-425 changes the STATUS of.
 *
 * ## Why this route is different from the other fifteen
 *
 * Every other refined request body had its rule duplicated somewhere further
 * in: the service re-parses with the same schema, or an explicit override
 * re-checks the invariant, or the handler kept a second-line parse. On those,
 * repairing the factory moves WHERE the 400 comes from and nothing else.
 *
 * Not here. The route declares `ExperienceAdminCreateInputCheckedSchema`, the
 * handler re-parses nothing, and `ExperienceService.createSchema` is
 * `ExperienceAdminCreateInputSchema` — the UNCHECKED twin, whose own JSDoc says
 * it "stays free of refinements so it remains slice-able". So
 * `requirePriceUnitUnlessOnRequest` had no second home, and the factory
 * dropping it meant it ran nowhere.
 *
 * In plain terms: an admin who fills in a price, leaves "a consultar" unticked
 * and picks no unit used to get a 201 and a listing with a null `priceUnit`.
 * After this change the same request is a 400 naming `priceUnit`.
 *
 * That is a genuine, caller-visible behaviour change, and it is the one the
 * issue warned about. It is also almost certainly the DESIRED behaviour — the
 * rule was written to be enforced — but it must be stated rather than
 * discovered, which is what this test is for.
 *
 * @module test/routes/experience/admin/create-price-unit-rule
 */

import { ExperienceService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const DESTINATION_ID = '99999999-9999-4999-8999-999999999991';
const OWNER_ID = '99999999-9999-4999-8999-999999999992';

const ADMIN_HEADERS = {
    'Content-Type': 'application/json',
    'user-agent': 'vitest',
    'x-mock-actor-id': ACTOR_ID,
    'x-mock-actor-role': 'ADMIN',
    // `commerce.viewAll` rides along because the admin experience router mounts
    // its LIST route at the same '/' path, and a sub-app's middleware applies
    // to every method on it.
    'x-mock-actor-permissions': JSON.stringify([
        'access.panelAdmin',
        'experience.create',
        'commerce.create',
        'commerce.viewAll',
        'experience.viewAll'
    ])
};

/** A create body that satisfies every field-level rule. */
const baseBody = (pricing: Record<string, unknown>) => ({
    name: 'Kayak al amanecer',
    slug: 'kayak-al-amanecer',
    summary: 'Una salida en kayak por el rio Uruguay con guia certificado.',
    description:
        'Una salida en kayak por el rio Uruguay con guia certificado, equipo incluido ' +
        'y desayuno al regresar, apta para principiantes y de dos horas de duracion.',
    type: 'KAYAK_RENTAL',
    destinationId: DESTINATION_ID,
    ownerId: OWNER_ID,
    priceFrom: 5000,
    ...pricing
});

let app: AppOpenAPI;
let createSpy: ReturnType<typeof vi.spyOn>;

const post = (body: unknown) =>
    app.request('/api/v1/admin/experiences', {
        method: 'POST',
        headers: ADMIN_HEADERS,
        body: JSON.stringify(body)
    });

beforeAll(async () => {
    app = initApp();
});

beforeEach(() => {
    // Stubbed so the assertions are about the ROUTE boundary. With the real
    // service the 400 could not be told apart from a service-layer rejection —
    // which is precisely the thing this route does NOT have.
    createSpy = vi.spyOn(ExperienceService.prototype, 'create').mockResolvedValue({
        data: { id: '55555555-5555-4555-8555-555555555555' }
    } as never);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('POST /admin/experiences — priceUnit is required unless the price is on request', () => {
    it('refuses a priced listing with no unit, and names the field', async () => {
        const response = await post(baseBody({ isPriceOnRequest: false }));
        const payload = (await response.json()) as {
            error?: { code?: string; details?: Array<{ field?: string }> };
        };

        expect(response.status).toBe(400);
        expect(payload.error?.code).toBe('VALIDATION_ERROR');
        expect(payload.error?.details?.map((detail) => detail.field)).toContain('priceUnit');
        // The service is where this body used to end up, with the rule never
        // having run. Nothing reaches it now.
        expect(createSpy).not.toHaveBeenCalled();
    });

    it('accepts the same listing once a unit is chosen', async () => {
        const response = await post(baseBody({ isPriceOnRequest: false, priceUnit: 'per_person' }));

        expect(response.status).not.toBe(400);
        expect(createSpy).toHaveBeenCalledTimes(1);
    });

    it('accepts a listing with no unit when the price IS on request', async () => {
        // The rule's escape hatch. Without this the test above would also pass
        // on a route that rejects every body missing `priceUnit`, which is a
        // different and wrong rule.
        const response = await post(baseBody({ isPriceOnRequest: true }));

        expect(response.status).not.toBe(400);
        expect(createSpy).toHaveBeenCalledTimes(1);
    });
});
