/**
 * HTTP-to-domain mapping for the protected amenity writes (HOS-573).
 *
 * Both PATCH and PUT forwarded the raw HTTP body to `AmenityService.update`
 * without calling `httpToDomainAmenityUpdate`.
 *
 * This mapper is the narrowest of the batch: everything is identity except one
 * field, and that one is INVERTED — `isActive` becomes `!isActive` under the
 * name `isBuiltin`. `AmenityUpdateInputSchema` is NOT `.strict()`, so `isActive`
 * was silently dropped and the response was a `200`: the toggle did nothing and
 * said it worked. Narrow blast radius, but the failure mode is the bad one.
 *
 * @module test/routes/amenity/protected/http-domain-mapping
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { AmenityService } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { protectedPatchAmenityRoute } from '../../../../src/routes/amenity/protected/patch.js';
import { protectedUpdateAmenityRoute } from '../../../../src/routes/amenity/protected/update.js';
import type { AppBindings } from '../../../../src/types.js';

const AMENITY_ID = '66666666-6666-4666-8666-666666666666';
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';

const HEADERS = { 'Content-Type': 'application/json', 'user-agent': 'vitest' };

let updateSpy: ReturnType<typeof vi.spyOn>;

/** These routes gate on a permission only — no ownership, so no entity fetcher. */
function buildApp(method: 'patch' | 'put'): Hono<AppBindings> {
    const app = new Hono<AppBindings>();

    app.use((c, next) => {
        c.set('actor', {
            id: ACTOR_ID,
            roles: [RoleEnum.ADMIN],
            permissions: [PermissionEnum.AMENITY_UPDATE]
        });
        return next();
    });

    app.route('/', method === 'patch' ? protectedPatchAmenityRoute : protectedUpdateAmenityRoute);

    return app;
}

/** Sends the write and returns the domain input the service received. */
async function write(
    method: 'patch' | 'put',
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const response = await buildApp(method).request(`/${AMENITY_ID}`, {
        method: method.toUpperCase(),
        headers: HEADERS,
        body: JSON.stringify(body)
    });

    expect(
        updateSpy,
        `AmenityService.update was never called — the request stopped at ${response.status}`
    ).toHaveBeenCalledTimes(1);

    return (updateSpy.mock.calls[0]?.[2] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
    updateSpy = vi.spyOn(AmenityService.prototype, 'update').mockResolvedValue({
        data: { id: AMENITY_ID, slug: 'mock' }
    } as never);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe.each([
    'patch',
    'put'
] as const)('%s /protected/amenities/:id — HTTP to domain mapping (HOS-573)', (method) => {
    it('turns isActive into its inverse under isBuiltin', async () => {
        const input = await write(method, { isActive: true });

        expect(input.isBuiltin).toBe(false);
        expect(Object.keys(input)).not.toContain('isActive');
    });

    it('inverts the other direction too', async () => {
        const input = await write(method, { isActive: false });

        expect(input.isBuiltin).toBe(true);
    });

    it('leaves isBuiltin absent when isActive was not sent', async () => {
        // `undefined` here means "no change", not "make it builtin". Emitting
        // `false` for an absent key would flip every amenity on any edit.
        const input = await write(method, { icon: 'wifi' });

        expect(input.isBuiltin).toBeUndefined();
        expect(input.icon).toBe('wifi');
    });
});
