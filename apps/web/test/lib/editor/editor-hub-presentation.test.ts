import { describe, expect, it } from 'vitest';
import {
    resolveAccommodationCompleteness,
    resolveListingEditorCompleteness
} from '@/lib/editor/editor-completeness';
import { resolveEditorHubPresentation } from '@/lib/editor/editor-hub-presentation';

describe('shared hub presentation', () => {
    it('keeps required completeness ready while labeling missing price as recommended', () => {
        const completeness = resolveAccommodationCompleteness({
            input: {
                description: 'A complete description of the property.',
                capacity: 4,
                minNights: 1,
                bedrooms: 1,
                bathrooms: 1,
                hasMainImage: true
            }
        });
        const model = resolveEditorHubPresentation({
            completeness,
            statuses: {
                capacityPricing: { labelKey: 'missingPrice', tone: 'warning' }
            }
        });
        expect(model.completeness.done).toBe(model.completeness.total);
        expect(model.statuses.capacityPricing).toMatchObject({
            completion: 'complete',
            tone: 'warning'
        });
        expect(model.statuses.basicInfo).toMatchObject({ completion: 'complete' });
        expect(model.recommendedCount).toBe(1);
        expect(model.statuses.calendar).toBeUndefined();
    });

    it.each([
        'venue',
        'experience'
    ] as const)('exposes known incomplete and complete rows for %s', (vertical) => {
        const completeness = resolveListingEditorCompleteness({
            vertical,
            listing: { isPriceOnRequest: true }
        });
        const model = resolveEditorHubPresentation({ completeness, statuses: {} });
        expect(model.statuses.basicInfo.completion).toBe('incomplete');
        expect(model.statuses.media.completion).toBe('incomplete');
        if (vertical === 'experience') expect(model.statuses.price.completion).toBe('complete');
        expect(model.statuses.faqs).toBeUndefined();
    });

    it('preserves locks and counts only advisory warnings', () => {
        const model = resolveEditorHubPresentation({
            completeness: { done: 0, total: 1, missing: ['photos'], requiredSections: ['photos'] },
            statuses: {
                photos: { tone: 'blocking', labelKey: 'required' },
                calendar: { tone: 'locked', labelKey: 'locked' }
            }
        });
        expect(model.statuses.photos.completion).toBe('incomplete');
        expect(model.statuses.calendar.tone).toBe('locked');
        expect(model.recommendedCount).toBe(0);
    });
});
