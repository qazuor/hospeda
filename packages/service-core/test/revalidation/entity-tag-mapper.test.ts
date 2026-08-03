/**
 * @fileoverview
 * Unit tests for `getAffectedCacheTags` (HOS-369 W1-1) — the entity→cache-tag
 * mapping that replaced `entity-path-mapper.ts`'s entity→URL-path mapping.
 *
 * Covers every `entityType` branch of {@link EntityChangeData}, including the
 * degenerate cases (no identifying key) and the unknown-type fallback.
 * All exports under test are pure — no mocks needed.
 */

import { describe, expect, it } from 'vitest';
import type { EntityChangeData } from '../../src/revalidation/entity-change.types.js';
import { getAffectedCacheTags } from '../../src/revalidation/entity-tag-mapper.js';

describe('getAffectedCacheTags', () => {
    describe('accommodation', () => {
        it('yields all four tag families when slug, id, and destinationSlug are all present', () => {
            const tags = getAffectedCacheTags({
                entityType: 'accommodation',
                slug: 'cabana-del-rio',
                id: '11111111-1111-4111-8111-111111111111',
                destinationSlug: 'concordia'
            });

            // Entity tag (by slug)
            expect(tags).toContain('accom-cabana-del-rio');
            // Entity tag (by id) — both identifiers are tagged, not just one
            expect(tags).toContain('accom-11111111-1111-4111-8111-111111111111');
            // Collection tag — covers every accommodation listing/facet page
            expect(tags).toContain('list-accom');
            // Home tag — the home page shows featured accommodations
            expect(tags).toContain('home');
            // Parent destination tag — its page lists this accommodation
            expect(tags).toContain('dest-concordia');
        });

        it('yields only the collection and home tags when no identifiers are supplied', () => {
            const tags = getAffectedCacheTags({ entityType: 'accommodation' });

            // `toEqual`, not `arrayContaining`: the claim is "ONLY these", and
            // `arrayContaining` is satisfied by any superset — it would pass even
            // if a malformed `accom-undefined` were emitted alongside them.
            expect(tags).toEqual(['list-accom', 'home']);
        });

        it('deduplicates when slug and id are equal-valued strings', () => {
            const tags = getAffectedCacheTags({
                entityType: 'accommodation',
                slug: 'same-value',
                id: 'same-value'
            });

            // Only one 'accom-same-value' entry despite two identifiers pointing
            // at the same normalized tag.
            expect(tags.filter((t) => t === 'accom-same-value')).toHaveLength(1);
        });
    });

    describe('destination', () => {
        it('yields its own tag, the collection tag, home, and the accommodation collection tag', () => {
            const tags = getAffectedCacheTags({
                entityType: 'destination',
                slug: 'concordia',
                id: '22222222-2222-4222-8222-222222222222'
            });

            expect(tags).toContain('dest-concordia');
            expect(tags).toContain('dest-22222222-2222-4222-8222-222222222222');
            expect(tags).toContain('list-dest');
            expect(tags).toContain('home');
            // Accommodation listings render the destination's name/region.
            expect(tags).toContain('list-accom');
        });

        it('yields the collection tags even with no slug or id', () => {
            const tags = getAffectedCacheTags({ entityType: 'destination' });

            expect(tags).toEqual(expect.arrayContaining(['list-dest', 'home', 'list-accom']));
        });
    });

    describe('event', () => {
        it('yields its own tag, list-event, home, and the parent destination tag when all context is present', () => {
            const tags = getAffectedCacheTags({
                entityType: 'event',
                slug: 'festival-de-la-playa',
                destinationSlug: 'concordia'
            });

            expect(tags).toContain('event-festival-de-la-playa');
            expect(tags).toContain('list-event');
            expect(tags).toContain('home');
            expect(tags).toContain('dest-concordia');
        });

        it('yields list-event + home when no slug is provided', () => {
            const tags = getAffectedCacheTags({ entityType: 'event' });

            expect(tags).toEqual(['list-event', 'home']);
        });
    });

    describe('post', () => {
        it('yields its own tag, list-post, and home when a slug is present', () => {
            const tags = getAffectedCacheTags({
                entityType: 'post',
                slug: 'novedades-de-la-temporada'
            });

            expect(tags).toContain('post-novedades-de-la-temporada');
            expect(tags).toContain('list-post');
            expect(tags).toContain('home');
        });

        it('yields list-post + home when no slug is provided', () => {
            const tags = getAffectedCacheTags({ entityType: 'post' });

            expect(tags).toEqual(['list-post', 'home']);
        });
    });

    describe('accommodation_review', () => {
        it('yields the parent accommodation tag and the accommodation collection tag', () => {
            const tags = getAffectedCacheTags({
                entityType: 'accommodation_review',
                accommodationSlug: 'cabana-del-rio'
            });

            expect(tags).toEqual(expect.arrayContaining(['accom-cabana-del-rio', 'list-accom']));
        });

        it('yields only the collection tag when no accommodationSlug is provided', () => {
            const tags = getAffectedCacheTags({ entityType: 'accommodation_review' });

            expect(tags).toEqual(['list-accom']);
        });
    });

    describe('destination_review', () => {
        it('yields the parent destination tag and the destination collection tag', () => {
            const tags = getAffectedCacheTags({
                entityType: 'destination_review',
                destinationSlug: 'concordia'
            });

            expect(tags).toEqual(expect.arrayContaining(['dest-concordia', 'list-dest']));
        });

        it('yields only the collection tag when no destinationSlug is provided', () => {
            const tags = getAffectedCacheTags({ entityType: 'destination_review' });

            expect(tags).toEqual(['list-dest']);
        });
    });

    describe('tag', () => {
        it('yields only the accommodation collection tag — tags have no page of their own', () => {
            const tags = getAffectedCacheTags({ entityType: 'tag' });

            expect(tags).toEqual(['list-accom']);
        });
    });

    describe('amenity', () => {
        it('yields only the accommodation collection tag — amenities have no page of their own', () => {
            const tags = getAffectedCacheTags({ entityType: 'amenity' });

            expect(tags).toEqual(['list-accom']);
        });
    });

    describe('unknown entityType', () => {
        it('yields an empty array rather than throwing', () => {
            const tags = getAffectedCacheTags({
                entityType: 'not-a-real-entity-type'
            } as unknown as EntityChangeData);

            expect(tags).toEqual([]);
        });
    });
});
