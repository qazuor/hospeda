/**
 * HTTP-to-domain mapping for the protected event-organizer writes (HOS-573).
 *
 * Both PATCH and PUT forwarded the raw HTTP body to
 * `EventOrganizerService.update` without calling `httpToDomainEventOrganizerUpdate`.
 * The mapper is not an identity: it folds `email`/`phone`/`website` into
 * `contactInfo` and the four socials into `socialNetworks` (with `linkedin`
 * renamed to `linkedIn`). `EventOrganizerUpdateInputSchema` IS `.strict()`, so
 * those flat keys reach it as unrecognized and the request 400s — the same shape
 * as H-30 on events.
 *
 * The assertions read the argument the service received, driven by a real
 * request through the real route: the seam between mapper and service is where
 * the contract broke, and each side tested alone could not see it.
 *
 * @module test/routes/event-organizer/protected/http-domain-mapping
 */

import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { EventOrganizerService } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearEntityFetchers,
    registerEntityFetcher
} from '../../../../src/middlewares/ownership.js';
import { protectedPatchEventOrganizerRoute } from '../../../../src/routes/event-organizer/protected/patch.js';
import { protectedUpdateEventOrganizerRoute } from '../../../../src/routes/event-organizer/protected/update.js';
import type { AppBindings } from '../../../../src/types.js';

// Strict UUID v4: group 3 must start with `4`, group 4 with 8/9/a/b. A body with
// a malformed id 400s at param validation before the route ever runs.
const ORGANIZER_ID = '44444444-4444-4444-8444-444444444444';
const CREATOR_ID = '11111111-1111-4111-8111-111111111111';

const HEADERS = { 'Content-Type': 'application/json', 'user-agent': 'vitest' };

let updateSpy: ReturnType<typeof vi.spyOn>;

function buildApp(method: 'patch' | 'put'): Hono<AppBindings> {
    const app = new Hono<AppBindings>();

    app.use((c, next) => {
        c.set('actor', {
            id: CREATOR_ID,
            roles: [RoleEnum.USER],
            permissions: [PermissionEnum.EVENT_ORGANIZER_UPDATE]
        });
        return next();
    });

    app.route(
        '/',
        method === 'patch' ? protectedPatchEventOrganizerRoute : protectedUpdateEventOrganizerRoute
    );

    return app;
}

/** Sends the write and returns the domain input the service received. */
async function write(
    method: 'patch' | 'put',
    body: Record<string, unknown>
): Promise<Record<string, unknown>> {
    const response = await buildApp(method).request(`/${ORGANIZER_ID}`, {
        method: method.toUpperCase(),
        headers: HEADERS,
        body: JSON.stringify(body)
    });

    expect(
        updateSpy,
        `EventOrganizerService.update was never called — the request stopped at ${response.status}`
    ).toHaveBeenCalledTimes(1);

    return (updateSpy.mock.calls[0]?.[2] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
    registerEntityFetcher('eventOrganizer', async () => ({
        data: { id: ORGANIZER_ID, createdById: CREATOR_ID }
    }));

    updateSpy = vi.spyOn(EventOrganizerService.prototype, 'update').mockResolvedValue({
        data: { id: ORGANIZER_ID, name: 'mock' }
    } as never);
});

afterEach(() => {
    clearEntityFetchers();
    vi.restoreAllMocks();
});

describe.each([
    'patch',
    'put'
] as const)('%s /protected/event-organizers/:id — HTTP to domain mapping (HOS-573)', (method) => {
    it('nests the contact fields under contactInfo', async () => {
        const input = await write(method, {
            phone: '+5493435551234',
            email: 'organizer@example.com',
            website: 'https://example.com'
        });

        const contact = input.contactInfo as Record<string, unknown> | undefined;

        expect(contact?.mobilePhone).toBe('+5493435551234');
        expect(contact?.personalEmail).toBe('organizer@example.com');
        expect(contact?.website).toBe('https://example.com');
        expect(Object.keys(input)).not.toContain('phone');
        expect(Object.keys(input)).not.toContain('email');
    });

    it('nests the socials under socialNetworks and renames linkedin', async () => {
        const input = await write(method, {
            facebook: 'https://facebook.com/org',
            linkedin: 'https://linkedin.com/company/org'
        });

        const social = input.socialNetworks as Record<string, unknown> | undefined;

        expect(social?.facebook).toBe('https://facebook.com/org');
        // The domain spells it with a capital I; the HTTP surface does not.
        expect(social?.linkedIn).toBe('https://linkedin.com/company/org');
        expect(Object.keys(input)).not.toContain('linkedin');
    });

    it('still forwards the fields whose names already match the domain', async () => {
        const input = await write(method, { name: 'A renamed organizer' });

        expect(input.name).toBe('A renamed organizer');
    });
});
