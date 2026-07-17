/**
 * @file facet-config.test.ts
 * @description Unit tests for the per-facet multi-select filter config model
 * (HOS-96 T-001). Asserts the exact shape/values of the product contract
 * declared in `.specs/HOS-96-multi-select-quick-filter-chips/spec.md`
 * ("The per-facet configuration model") for all four facets, and that the
 * config is immutable at runtime.
 */

import { AccommodationTypeEnum, EventCategoryEnum, PostCategoryEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { FACET_CONFIG_BY_ID, FACET_CONFIGS } from '../../../src/lib/filters/facet-config';

describe('facet-config', () => {
    describe('accommodation type facet', () => {
        it('should declare the exact product-contract shape', () => {
            const config = FACET_CONFIG_BY_ID.accommodationType;

            expect(config.paramKey).toBe('types');
            expect(config.singularParamKey).toBe('type');
            expect(config.operator).toBe('OR');
            expect(config.enum).toBe(AccommodationTypeEnum);
            expect(config.dedicatedLandingPattern).toBe('/alojamientos/tipo/{slug}/');
            expect(config.outOfBackendScope).toBe(false);
        });
    });

    describe('event category facet', () => {
        it('should declare the exact product-contract shape', () => {
            const config = FACET_CONFIG_BY_ID.eventCategory;

            expect(config.paramKey).toBe('categories');
            expect(config.singularParamKey).toBe('category');
            expect(config.operator).toBe('OR');
            expect(config.enum).toBe(EventCategoryEnum);
            // Owner decision (HOS-96 T-017/18/19 integration review): events
            // KEEPS its dedicated `/eventos/categoria/{slug}/` landing
            // (SPEC-306 already built it, and `/eventos/?category=X` already
            // canonicalizes to it today) as the 1-value canonical — consistent
            // with accommodations/blog, not a regression. The spec's original
            // config table wrongly said events had no dedicated landing.
            expect(config.dedicatedLandingPattern).toBe('/eventos/categoria/{slug}/');
            expect(config.outOfBackendScope).toBe(false);
        });
    });

    describe('blog/post category facet', () => {
        it('should declare the exact product-contract shape', () => {
            const config = FACET_CONFIG_BY_ID.postCategory;

            expect(config.paramKey).toBe('categories');
            expect(config.singularParamKey).toBe('category');
            expect(config.operator).toBe('OR');
            expect(config.enum).toBe(PostCategoryEnum);
            expect(config.dedicatedLandingPattern).toBe('/publicaciones/categoria/{slug}/');
            expect(config.outOfBackendScope).toBe(false);
        });
    });

    describe('destination attraction facet', () => {
        it('should declare AND operator and out-of-backend-scope (US-12, client-side only)', () => {
            const config = FACET_CONFIG_BY_ID.destinationAttraction;

            expect(config.paramKey).toBe('attractions');
            expect(config.singularParamKey).toBeUndefined();
            expect(config.operator).toBe('AND');
            expect(config.dedicatedLandingPattern).toBeUndefined();
            expect(config.outOfBackendScope).toBe(true);
        });
    });

    describe('POI category facet (HOS-147)', () => {
        it('should declare OR operator, DB-driven values, and client-side (out-of-backend) scope', () => {
            const config = FACET_CONFIG_BY_ID.pointOfInterestCategory;

            // `categories` CSV array param, OR/any-of union (spec D-1).
            expect(config.paramKey).toBe('categories');
            // New facet — no legacy scalar param.
            expect(config.singularParamKey).toBeUndefined();
            expect(config.operator).toBe('OR');
            // DB-driven category slugs from the public catalog, not a static
            // enum — like destinationAttraction.
            expect(config.enum).toBeUndefined();
            // No dedicated landing (NG-4): the destination page stays canonical.
            expect(config.dedicatedLandingPattern).toBeUndefined();
            // Owner decision D-3: resolved entirely client-side over the
            // already-loaded POI list, never a backend/API concern.
            expect(config.outOfBackendScope).toBe(true);
        });
    });

    describe('extensibility', () => {
        it('should expose all facets in FACET_CONFIGS for iteration', () => {
            const ids = FACET_CONFIGS.map((config) => config.id);
            expect(ids).toEqual(
                expect.arrayContaining([
                    'accommodationType',
                    'eventCategory',
                    'postCategory',
                    'destinationAttraction',
                    'pointOfInterestCategory'
                ])
            );
            expect(FACET_CONFIGS).toHaveLength(5);
        });
    });

    describe('immutability', () => {
        it('should be frozen at runtime (FACET_CONFIG_BY_ID)', () => {
            expect(Object.isFrozen(FACET_CONFIG_BY_ID)).toBe(true);
        });

        it('should be frozen at runtime (each individual facet config)', () => {
            for (const config of FACET_CONFIGS) {
                expect(Object.isFrozen(config)).toBe(true);
            }
        });

        it('should be frozen at runtime (FACET_CONFIGS array)', () => {
            expect(Object.isFrozen(FACET_CONFIGS)).toBe(true);
        });

        it('should throw in strict mode when attempting to mutate a facet config', () => {
            expect(() => {
                // @ts-expect-error Testing runtime immutability guard
                FACET_CONFIG_BY_ID.accommodationType.paramKey = 'mutated';
            }).toThrow();
        });
    });
});
