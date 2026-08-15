/**
 * HTTP-to-domain mapping for the protected event-location writes (HOS-573).
 *
 * Both PATCH and PUT forwarded the raw HTTP body to
 * `EventLocationService.update` without calling `httpToDomainEventLocationUpdate`.
 * The mapper renames and nests `latitude`/`longitude` into
 * `coordinates.{lat,long}` — and stringifies them, because the domain stores
 * coordinates as strings. `EventLocationUpdateInputSchema` IS `.strict()`, so
 * the flat pair reaches it as unrecognized keys and the request 400s.
 *
 * @module test/routes/event-location/protected/http-domain-mapping
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { EventLocationService } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearEntityFetchers,
    registerEntityFetcher
} from '../../../../src/middlewares/ownership.js';
import { protectedPatchEventLocationRoute } from '../../../../src/routes/event-location/protected/patch.js';
import { protectedUpdateEventLocationRoute } from '../../../../src/routes/event-location/protected/update.js';
import type { AppBindings } from '../../../../src/types.js';

const LOCATION_ID = '55555555-5555-4555-8555-555555555555';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';

const HEADERS = { 'Content-Type': 'application/json', 'user-agent': 'vitest' };

let updateSpy: ReturnType<typeof vi.spyOn>;

function buildApp(method: 'patch' | 'put'): Hono<AppBindings> {
    const app = new Hono<AppBindings>();

    app.use((c, next) => {
        c.set('actor', {
            id: OWNER_ID,
            roles: [RoleEnum.USER],
            permissions: [PermissionEnum.EVENT_LOCATION_UPDATE]
        });
        return next();
    });

    app.route(
        '/',
        method === 'patch' ? protectedPatchEventLocationRoute : protectedUpdateEventLocationRoute
    );

    return app;
}

/** Sends the write and returns the domain input the service received. */
async function write(
    method: 'patch' | 'put',
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const response = await buildApp(method).request(`/${LOCATION_ID}`, {
        method: method.toUpperCase(),
        headers: HEADERS,
        body: JSON.stringify(body)
    });

    expect(
        updateSpy,
        `EventLocationService.update was never called — the request stopped at ${response.status}`
    ).toHaveBeenCalledTimes(1);

    return (updateSpy.mock.calls[0]?.[2] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
    registerEntityFetcher('eventLocation', async () => ({
        data: { id: LOCATION_ID, ownerId: OWNER_ID, createdById: OWNER_ID }
    }));

    updateSpy = vi.spyOn(EventLocationService.prototype, 'update').mockResolvedValue({
        data: { id: LOCATION_ID, placeName: 'mock' }
    } as never);
});

afterEach(() => {
    clearEntityFetchers();
    vi.restoreAllMocks();
});

describe.each([
    'patch',
    'put'
] as const)('%s /protected/event-locations/:id — HTTP to domain mapping (HOS-573)', (method) => {
    it('nests latitude/longitude under coordinates as strings', async () => {
        const input = await write(method, { latitude: -32.47, longitude: -58.23 });

        const coords = input.coordinates as Record<string, unknown> | undefined;

        expect(coords?.lat).toBe('-32.47');
        expect(coords?.long).toBe('-58.23');
        expect(Object.keys(input)).not.toContain('latitude');
        expect(Object.keys(input)).not.toContain('longitude');
    });

    it('still forwards the address fields whose names already match', async () => {
        const input = await write(method, { street: 'Av. Siempreviva', number: '742' });

        expect(input.street).toBe('Av. Siempreviva');
        expect(input.number).toBe('742');
    });
});
