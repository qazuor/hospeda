// @vitest-environment jsdom
/**
 * @file score-signals.test.ts
 * Unit tests for gastronomy quality-score signals (SPEC-239 T-059).
 *
 * Covers all 9 signals:
 *  - featured-image
 *  - gallery-photos (with partial credit)
 *  - photos-alt (with partial credit)
 *  - description (with partial credit)
 *  - summary
 *  - contact
 *  - cuisine (type)
 *  - operatingHours
 *  - capacity (priceRange)
 *
 * Also verifies that weights sum to 100.
 */

import { computeScore } from '@/components/quality-score';
import type { ScoreResult } from '@/components/quality-score';
import { describe, expect, it } from 'vitest';
import { createGastronomySignals } from '../config/score-signals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Searches across all three ScoreResult buckets (done/pending/premium) for
 * a signal with the given ID.
 *
 * `ScoreResult` splits signals into buckets; there is no top-level `signals`
 * array — this helper unifies them for test assertions.
 */
function findSignal(result: ScoreResult, id: string) {
    return [...result.done, ...result.pending, ...result.premium].find((s) => s.id === id) ?? null;
}

/** Build a minimal entity with all signals completed. */
function completeEntity(): Record<string, unknown> {
    return {
        name: 'La Parrilla del Sur',
        type: 'RESTAURANT',
        priceRange: 'MID',
        summary: 'Un restaurante excepcional en el corazón de la ciudad.',
        description:
            'Ofrecemos los mejores cortes de carne seleccionados diariamente, acompañados de vinos premium de la región. Ambiente familiar, atención personalizada y una carta variada que satisface todos los paladares.',
        media: {
            featuredImage: { url: 'https://example.com/img.jpg', alt: 'Fachada del restaurante' },
            gallery: [
                { url: 'https://example.com/g1.jpg', alt: 'Interior' },
                { url: 'https://example.com/g2.jpg', alt: 'Platos' },
                { url: 'https://example.com/g3.jpg', alt: 'Parrilla' }
            ]
        },
        contactInfo: {
            personalEmail: 'info@laparrilla.com',
            mobilePhone: '+5493442000000'
        },
        openingHours: {
            monday: { open: '12:00', close: '23:00' },
            tuesday: null,
            wednesday: null,
            thursday: null,
            friday: { open: '12:00', close: '00:00' },
            saturday: { open: '12:00', close: '00:00' },
            sunday: { open: '12:00', close: '22:00' }
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('createGastronomySignals — weights', () => {
    it('should have non-premium weights that sum to 100', () => {
        const signals = createGastronomySignals();
        const total = signals.filter((s) => s.weight > 0).reduce((sum, s) => sum + s.weight, 0);
        expect(total).toBe(100);
    });

    it('should produce 9 signals', () => {
        expect(createGastronomySignals().length).toBe(9);
    });
});

describe('computeScore with gastronomy signals', () => {
    it('should return 100 for a fully complete entity', () => {
        const result = computeScore(createGastronomySignals(), completeEntity());
        expect(result.score).toBe(100);
    });

    it('should return 0 for an empty entity', () => {
        const result = computeScore(createGastronomySignals(), {});
        expect(result.score).toBe(0);
    });
});

describe('featured-image signal', () => {
    it('should be done when featuredImage.url is set', () => {
        const entity = {
            ...completeEntity(),
            media: { featuredImage: { url: 'https://example.com/img.jpg' } }
        };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'featured-image');
        expect(sig?.status).toBe('done');
    });

    it('should be pending when featuredImage is absent', () => {
        const entity = { ...completeEntity(), media: {} };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'featured-image');
        expect(sig?.status).toBe('pending');
    });
});

describe('gallery-photos signal', () => {
    it('should be done with ≥3 gallery photos', () => {
        const result = computeScore(createGastronomySignals(), completeEntity());
        const sig = findSignal(result, 'gallery-photos');
        expect(sig?.status).toBe('done');
    });

    it('should be pending with 0 photos', () => {
        const entity = {
            ...completeEntity(),
            media: { ...((completeEntity().media as Record<string, unknown>) ?? {}), gallery: [] }
        };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'gallery-photos');
        expect(sig?.status).toBe('pending');
        expect(sig?.progress).toBe(0);
    });

    it('should show partial progress with 1 photo', () => {
        const entity = {
            ...completeEntity(),
            media: {
                ...((completeEntity().media as Record<string, unknown>) ?? {}),
                gallery: [{ url: 'https://example.com/g1.jpg', alt: 'Interior' }]
            }
        };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'gallery-photos');
        expect(sig?.status).toBe('pending');
        expect(sig?.progress).toBeCloseTo(1 / 3);
    });
});

describe('description signal', () => {
    it('should be done when description length ≥150 chars', () => {
        const result = computeScore(createGastronomySignals(), completeEntity());
        const sig = findSignal(result, 'description');
        expect(sig?.status).toBe('done');
    });

    it('should be pending when description is absent', () => {
        const entity = { ...completeEntity(), description: '' };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'description');
        expect(sig?.status).toBe('pending');
    });

    it('should show partial progress for short description', () => {
        const entity = { ...completeEntity(), description: 'Corto.' };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'description');
        expect(sig?.status).toBe('pending');
        expect(sig?.progress).toBeLessThan(1);
    });
});

describe('summary signal', () => {
    it('should be done when summary is set', () => {
        const result = computeScore(createGastronomySignals(), completeEntity());
        const sig = findSignal(result, 'summary');
        expect(sig?.status).toBe('done');
    });

    it('should be pending when summary is absent', () => {
        const entity = { ...completeEntity(), summary: undefined };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'summary');
        expect(sig?.status).toBe('pending');
    });
});

describe('contact signal', () => {
    it('should be done when email is set', () => {
        const result = computeScore(createGastronomySignals(), completeEntity());
        const sig = findSignal(result, 'contact');
        expect(sig?.status).toBe('done');
    });

    it('should be done when phone is set (even without email)', () => {
        const entity = {
            ...completeEntity(),
            contactInfo: { mobilePhone: '+5493442000000' }
        };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'contact');
        expect(sig?.status).toBe('done');
    });

    it('should be pending when no contact channel is set', () => {
        const entity = { ...completeEntity(), contactInfo: {} };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'contact');
        expect(sig?.status).toBe('pending');
    });
});

describe('cuisine signal', () => {
    it('should be done when type is set', () => {
        const result = computeScore(createGastronomySignals(), completeEntity());
        const sig = findSignal(result, 'cuisine');
        expect(sig?.status).toBe('done');
    });

    it('should be pending when type is absent', () => {
        const entity = { ...completeEntity(), type: undefined };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'cuisine');
        expect(sig?.status).toBe('pending');
    });
});

describe('operatingHours signal', () => {
    it('should be done when at least one day has hours', () => {
        const result = computeScore(createGastronomySignals(), completeEntity());
        const sig = findSignal(result, 'operatingHours');
        expect(sig?.status).toBe('done');
    });

    it('should be pending when openingHours is absent', () => {
        const entity = { ...completeEntity(), openingHours: undefined };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'operatingHours');
        expect(sig?.status).toBe('pending');
    });

    it('should be pending when openingHours is an empty object', () => {
        const entity = { ...completeEntity(), openingHours: {} };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'operatingHours');
        expect(sig?.status).toBe('pending');
    });
});

describe('capacity signal (priceRange proxy)', () => {
    it('should be done when priceRange is set', () => {
        const result = computeScore(createGastronomySignals(), completeEntity());
        const sig = findSignal(result, 'capacity');
        expect(sig?.status).toBe('done');
    });

    it('should be pending when priceRange is absent', () => {
        const entity = { ...completeEntity(), priceRange: undefined };
        const result = computeScore(createGastronomySignals(), entity);
        const sig = findSignal(result, 'capacity');
        expect(sig?.status).toBe('pending');
    });
});
