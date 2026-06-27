import { getComparisonGroupLabel, getEntitlementName, getLimitName } from '@/lib/billing-i18n';
import type { EntitlementKey } from '@/lib/billing-i18n';
import { describe, expect, it } from 'vitest';

function makeTranslator(map: Record<string, string>): (key: string, fallback?: string) => string {
    return (key: string, fallback?: string) => map[key] ?? fallback ?? key;
}

describe('getLimitName', () => {
    it('should return the i18n value when the key exists', () => {
        const t = makeTranslator({ 'billing.comparison.limitLabel.max_favorites': 'Favoritos' });
        const result = getLimitName({ key: 'max_favorites', t });
        expect(result).toBe('Favoritos');
    });

    it('should fall back to LIMIT_METADATA name when no translation exists', () => {
        const t = makeTranslator({});
        const result = getLimitName({ key: 'max_favorites', t });
        expect(result).toBe('Favorites');
    });

    it('should fall back to humanized key when metadata is missing', () => {
        const t = makeTranslator({});
        const result = getLimitName({ key: 'unknown_limit_key', t });
        expect(result).toBe('Unknown Limit Key');
    });

    it('should handle all owner limit keys without throwing', () => {
        const t = makeTranslator({});
        const ownerLimits = [
            'max_accommodations',
            'max_photos_per_accommodation',
            'max_active_promotions',
            'max_properties',
            'max_staff_accounts',
            'max_ai_text_improve_per_month',
            'max_ai_chat_per_month',
            'max_ai_translate_per_month',
            'max_ai_accommodation_import_per_month'
        ];
        for (const key of ownerLimits) {
            expect(() => getLimitName({ key, t })).not.toThrow();
        }
    });

    it('should handle all tourist limit keys without throwing', () => {
        const t = makeTranslator({});
        const touristLimits = [
            'max_favorites',
            'max_active_alerts',
            'max_compare_items',
            'max_ai_text_improve_per_month',
            'max_ai_chat_per_month',
            'max_ai_search_per_month',
            'max_ai_support_per_month',
            'max_ai_translate_per_month'
        ];
        for (const key of touristLimits) {
            expect(() => getLimitName({ key, t })).not.toThrow();
        }
    });
});

describe('getComparisonGroupLabel', () => {
    it('should return the i18n value when the key exists', () => {
        const t = makeTranslator({ 'billing.comparison.group.owner': 'Funciones de propietario' });
        const result = getComparisonGroupLabel({ group: 'owner', t });
        expect(result).toBe('Funciones de propietario');
    });

    it('should fall back to humanized group name', () => {
        const t = makeTranslator({});
        const result = getComparisonGroupLabel({ group: 'ai', t });
        expect(result).toBe('Ai');
    });
});

describe('getEntitlementName (existing, regression check)', () => {
    it('should still work for known entitlement keys', () => {
        const t = makeTranslator({});
        const result = getEntitlementName({ key: 'save_favorites' as EntitlementKey, t });
        expect(result).toBe('Save favorites');
    });
});
