import { EntityTypeEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { preProcessBookmark } from '../../src/example/bookmarks.seed.js';
import {
    registerVenueIdMapping,
    VENUE_ID_MAPPER_NAMESPACE
} from '../../src/example/venues.seed.js';
import type { SeedContext } from '../../src/utils/seedContext.js';

describe('venue bookmark ID mapping', () => {
    it('resolves a VENUE bookmark through the namespace registered by the venue seed', async () => {
        const mappings = new Map<string, string>();
        const idMapper = {
            setMapping(namespace: string, seedId: string, realId: string) {
                mappings.set(`${namespace}:${seedId}`, realId);
            },
            getMappedUserId(seedId: string) {
                return seedId === 'bookmark-user' ? 'real-user-id' : undefined;
            },
            getRealId(namespace: string, seedId: string) {
                return mappings.get(`${namespace}:${seedId}`);
            }
        };
        registerVenueIdMapping(
            idMapper as unknown as SeedContext['idMapper'],
            'seed-venue',
            'real-venue-id',
            'Venue'
        );

        const bookmark: Record<string, unknown> = {
            userId: 'bookmark-user',
            entityId: 'seed-venue',
            entityType: EntityTypeEnum.VENUE
        };
        const context = { idMapper } as unknown as SeedContext;

        await preProcessBookmark(bookmark, context);

        expect(bookmark).toEqual({
            userId: 'real-user-id',
            entityId: 'real-venue-id',
            entityType: EntityTypeEnum.VENUE
        });
        expect(mappings.get(`${VENUE_ID_MAPPER_NAMESPACE}:seed-venue`)).toBe('real-venue-id');
    });
});
