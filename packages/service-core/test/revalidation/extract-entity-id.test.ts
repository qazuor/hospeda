/**
 * @fileoverview HOS-1871 regression: `revalidation_log.entity_id` must carry the
 * canonical UUID for EVERY entity type whose change event declares an `id`.
 *
 * `RevalidationService.extractEntityId` is a `switch` on `event.entityType`. It
 * used to return `event.id` only for `accommodation`, `destination`, `event` and
 * `post`; `venue`, `experience`, `attraction`, `partner` and `pointOfInterest`
 * all declare `id?: string` in `EntityChangeData` but had no `case`, so they fell
 * off the end of the function and wrote a NULL `entity_id`.
 *
 * The audit log is queried by `(entity_type, entity_id)` — the E2E revalidation
 * spy filters on exactly that pair — so a NULL id made a real purge look like it
 * never happened. This is a production bug, not a test artifact.
 *
 * The exhaustive `default` added alongside the fix makes a NEW `EntityChangeData`
 * variant break the typecheck instead of silently falling through to `undefined`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/db', () => ({
    RevalidationConfigModel: vi.fn().mockImplementation(function () {
        return {
            findByEntityType: vi.fn()
        };
    }),
    RevalidationLogModel: vi.fn().mockImplementation(function () {
        return {
            create: vi.fn().mockResolvedValue(undefined)
        };
    })
}));

vi.mock('@repo/logger', () => ({
    createLogger: vi.fn().mockReturnValue({
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    })
}));

import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';
import type { RevalidationAdapter } from '../../src/revalidation/adapters/revalidation.adapter.js';
import { WHOLE_ZONE_TARGET } from '../../src/revalidation/adapters/revalidation.adapter.js';
import type { EntityChangeData } from '../../src/revalidation/entity-change.types.js';
import { RevalidationService } from '../../src/revalidation/revalidation.service.js';

function makeEnabledConfig(entityType: string, debounceSeconds = 1) {
    return {
        id: 'cfg-id',
        entityType,
        enabled: true,
        autoRevalidateOnChange: true,
        debounceSeconds,
        cronIntervalMinutes: 60,
        createdAt: new Date(),
        updatedAt: new Date()
    };
}

function makeMockAdapter(): RevalidationAdapter {
    const revalidate = vi.fn((params: { readonly tag: string }) =>
        Promise.resolve({ success: true, target: params.tag, durationMs: 1 })
    );
    return {
        name: 'MockAdapter',
        revalidate,
        revalidateMany: vi.fn(async (params: { readonly tags: ReadonlyArray<string> }) =>
            params.tags.map((tag) => ({ success: true, target: tag, durationMs: 1 }))
        ),
        purgeEverything: vi.fn(async () => ({
            target: WHOLE_ZONE_TARGET,
            success: true,
            durationMs: 1
        }))
    };
}

function createTestService(adapter: RevalidationAdapter): RevalidationService {
    return new RevalidationService({ adapter, cacheTagEnvironment: 'test' });
}

const UUID_BY_TYPE = {
    accommodation: '550e8400-e29b-41d4-a716-446655440001',
    destination: '550e8400-e29b-41d4-a716-446655440002',
    event: '550e8400-e29b-41d4-a716-446655440003',
    post: '550e8400-e29b-41d4-a716-446655440004',
    venue: '550e8400-e29b-41d4-a716-446655440005',
    experience: '550e8400-e29b-41d4-a716-446655440006',
    attraction: '550e8400-e29b-41d4-a716-446655440007',
    partner: '550e8400-e29b-41d4-a716-446655440008',
    pointOfInterest: '550e8400-e29b-41d4-a716-446655440009'
} as const;

type IdBearingEntityType = keyof typeof UUID_BY_TYPE;

/** An event of a type that declares `id`, carrying that id. */
function idBearingEvent(entityType: IdBearingEntityType, id: string): EntityChangeData {
    return { entityType, id, slug: `slug-${entityType}` } as EntityChangeData;
}

/**
 * Events of types that do NOT declare `id` in `EntityChangeData`. They must keep
 * a NULL `entity_id`: writing a slug into a UUID column would make the column
 * unqueryable, which is exactly what the production comment warns against.
 */
const ID_LESS_EVENTS: ReadonlyArray<readonly [string, EntityChangeData]> = [
    ['accommodation_review', { entityType: 'accommodation_review', accommodationSlug: 'accom-a' }],
    ['destination_review', { entityType: 'destination_review', destinationSlug: 'dest-a' }],
    ['tag', { entityType: 'tag' }],
    ['amenity', { entityType: 'amenity' }]
];

describe('HOS-1871: extractEntityId writes the canonical UUID to the log', () => {
    let mockCreate: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.clearAllMocks();
        mockCreate = vi.fn().mockResolvedValue(undefined);
        (RevalidationConfigModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                findByEntityType: vi
                    .fn()
                    .mockImplementation((entityType: string) =>
                        Promise.resolve(makeEnabledConfig(entityType, 1))
                    )
            };
        });
        (RevalidationLogModel as ReturnType<typeof vi.fn>).mockImplementation(function () {
            return {
                create: mockCreate
            };
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    async function scheduleAndDrain(event: EntityChangeData): Promise<void> {
        const service = createTestService(makeMockAdapter());
        service.scheduleRevalidation(event);
        await vi.runAllTimersAsync();
        await Promise.resolve();
        await Promise.resolve();
    }

    it.each(
        Object.entries(UUID_BY_TYPE) as ReadonlyArray<[IdBearingEntityType, string]>
    )('%s with an id logs entityId === id', async (entityType, id) => {
        await scheduleAndDrain(idBearingEvent(entityType, id));

        expect(mockCreate).toHaveBeenCalled();
        const loggedIds = mockCreate.mock.calls.map(
            (call) => (call[0] as Record<string, unknown>).entityId
        );
        expect(loggedIds).toEqual(loggedIds.map(() => id));
    });

    it.each(ID_LESS_EVENTS)('%s without an id logs entityId === null', async (_label, event) => {
        await scheduleAndDrain(event);

        expect(mockCreate).toHaveBeenCalled();
        const loggedIds = mockCreate.mock.calls.map(
            (call) => (call[0] as Record<string, unknown>).entityId
        );
        expect(loggedIds).toEqual(loggedIds.map(() => null));
    });
});
