/**
 * Guard: every entity type a route configures for ownership must have a
 * registered entity fetcher.
 *
 * Background (HOS-374 phase 0): `ownershipMiddleware` looks the entity type up
 * in a registry and throws HTTP 500 when it finds nothing:
 *
 *   const fetcher = entityFetchers.get(entityType);
 *   if (!fetcher) throw new HTTPException(500, ...);
 *
 * `registerEntityFetchers()` only ever registered 'accommodation', while nine
 * protected routes (event, event-location and event-organizer update/patch/
 * softDelete) were configured with ownership. All nine returned 500 on every
 * request, in production, with no test covering any of them.
 *
 * Three fetchers would fix those nine routes and leave the trap armed for the
 * next one. This guard closes the class instead: configuring a route with an
 * unregistered entity type fails CI here rather than in production.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
    clearEntityFetchers,
    getRegisteredEntityTypes,
    ownershipMiddleware
} from '../../src/middlewares/ownership';

// The fetchers call real services; stub them so this exercises the registry and
// the middleware, not the database. Built via vi.hoisted because vi.mock's
// factory is hoisted above any top-level declaration it would otherwise close
// over.
const { stubService } = vi.hoisted(() => ({
    stubService: (createdById: string) =>
        class {
            getById = async () => ({ data: { id: 'entity-123', createdById } });
        }
}));

vi.mock('@repo/service-core', () => ({
    AccommodationService: stubService('user-123'),
    EventService: stubService('user-123'),
    EventLocationService: stubService('user-123'),
    EventOrganizerService: stubService('user-123')
}));

vi.mock('../../src/utils/actor');
vi.mock('../../src/utils/logger');

import { getActorFromContext } from '../../src/utils/actor';
import { registerEntityFetchers } from '../../src/utils/entity-fetchers';

const ROUTES_DIR = join(__dirname, '../../src/routes');

/**
 * Collect every .ts file under the routes tree.
 */
const collectRouteFiles = (dir: string): string[] => {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            return collectRouteFiles(full);
        }
        return entry.name.endsWith('.ts') ? [full] : [];
    });
};

/**
 * Extract the entity types used inside `ownership: { ... }` blocks.
 *
 * Scoped to the ownership block on purpose: `entityType` also appears in
 * unrelated contexts (the revalidation router uses `entityType: 'manual'`,
 * which is not an ownable entity and must not be treated as one.)
 */
const extractOwnershipEntityTypes = (source: string): string[] => {
    const found: string[] = [];
    const ownershipBlock = /ownership:\s*\{([\s\S]*?)\}/g;
    let match = ownershipBlock.exec(source);
    while (match !== null) {
        const entityType = /entityType:\s*'([a-zA-Z]+)'/.exec(match[1] as string);
        if (entityType?.[1]) {
            found.push(entityType[1]);
        }
        match = ownershipBlock.exec(source);
    }
    return found;
};

describe('ownership entity fetcher coverage (guard)', () => {
    let usedEntityTypes: Map<string, string[]>;

    beforeAll(() => {
        usedEntityTypes = new Map();
        for (const file of collectRouteFiles(ROUTES_DIR)) {
            for (const entityType of extractOwnershipEntityTypes(readFileSync(file, 'utf8'))) {
                const existing = usedEntityTypes.get(entityType) ?? [];
                existing.push(file.replace(`${ROUTES_DIR}/`, ''));
                usedEntityTypes.set(entityType, existing);
            }
        }
    });

    it('finds ownership-configured routes to check', () => {
        // Protects the guard from silently passing on a broken scan: if the
        // regex or the directory layout changes and nothing is found, the
        // assertions below would all vacuously pass.
        expect(usedEntityTypes.size).toBeGreaterThan(0);
    });

    it('registers a fetcher for every entity type used by a route', () => {
        clearEntityFetchers();
        registerEntityFetchers();
        const registered = new Set(getRegisteredEntityTypes());

        const missing = [...usedEntityTypes.entries()]
            .filter(([entityType]) => !registered.has(entityType as never))
            .map(([entityType, files]) => `${entityType} (used by: ${files.join(', ')})`);

        expect(
            missing,
            `These entity types are configured on a route but have no registered fetcher, so every request to those routes throws HTTP 500 before any permission logic runs. Register them in apps/api/src/utils/entity-fetchers.ts:\n  ${missing.join('\n  ')}`
        ).toEqual([]);
    });
});

describe('event-family ownership routes no longer 500 (regression, HOS-374)', () => {
    // Regression for the shipped defect: these three entity types were
    // configured on nine protected routes with no fetcher registered, so the
    // middleware threw before reaching any permission logic. The middleware's
    // own "no fetcher → 500" behavior was already covered in ownership.test.ts;
    // what nobody checked was whether the types actually used in production
    // were registered at all.
    const entityTypes = ['event', 'eventLocation', 'eventOrganizer'] as const;

    for (const entityType of entityTypes) {
        it(`resolves ownership for '${entityType}' instead of throwing 500`, async () => {
            vi.clearAllMocks();
            clearEntityFetchers();
            registerEntityFetchers();

            const actor: Actor = {
                id: 'user-123',
                roles: [RoleEnum.USER],
                permissions: [PermissionEnum.ACCESS_API_PUBLIC]
            };
            vi.mocked(getActorFromContext).mockReturnValue(actor);

            const app = new Hono();
            app.onError((err, c) => {
                if (err instanceof HTTPException) {
                    return c.json({ message: err.message }, err.status);
                }
                return c.json({ message: 'Internal server error' }, 500);
            });
            app.use('/:id', ownershipMiddleware({ entityType, ownershipFields: ['createdById'] }));
            app.get('/:id', (c) => c.json({ success: true }));

            const res = await app.request('/entity-123');

            expect(res.status).toBe(200);
        });
    }
});
