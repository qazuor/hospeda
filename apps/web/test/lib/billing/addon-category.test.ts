import { ENTITLEMENT_KEY_DEFINITIONS, LIMIT_KEY_DEFINITIONS } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    ADDON_CATEGORIES,
    ADDON_CATEGORY_BY_KEY,
    resolveAddonCategory
} from '@/lib/billing/addon-category';

describe('add-on category', () => {
    it.each([
        [['featured_listing'], 'visibility'],
        [['max_accommodations'], 'listings'],
        [['max_venues'], 'listings'],
        [['max_experiences'], 'listings'],
        [['max_photos_per_accommodation'], 'media'],
        [['ai_chat'], 'other'],
        [[], 'other'],
        [['unknown', 'constructor', '__proto__'], 'other'],
        [['ai_chat', 'unknown', 'max_venues', 'featured_listing'], 'listings']
    ] as const)('resolves %j to %s', (grantedKeys, category) => {
        expect(resolveAddonCategory({ grantedKeys })).toBe(category);
    });

    it('explicitly maps every real entitlement and limit catalog key', () => {
        for (const definition of [...ENTITLEMENT_KEY_DEFINITIONS, ...LIMIT_KEY_DEFINITIONS]) {
            expect(Object.hasOwn(ADDON_CATEGORY_BY_KEY, definition.key), definition.key).toBe(true);
            expect(ADDON_CATEGORIES).toContain(ADDON_CATEGORY_BY_KEY[definition.key]);
        }
    });
});
