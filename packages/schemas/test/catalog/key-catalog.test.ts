import { describe, expect, it } from 'vitest';
import {
    AGGREGATION_STRATEGIES,
    CatalogKeyDefinitionSchema,
    ENFORCEMENT_STRATEGIES,
    KEY_CLASSES,
    KEY_SCOPES
} from '../../src/catalog/key-attributes.js';
import {
    CATALOG_KEY_DEFINITIONS,
    CATALOG_KEY_NAMES,
    getCatalogKey,
    isCatalogKey
} from '../../src/catalog/key-catalog.js';
import {
    VERTICAL_ACTIVATION_EVENT_BY_VERTICAL,
    VERTICAL_ACTIVATION_EVENT_VALUES,
    VerticalActivationEventSchema
} from '../../src/catalog/vertical-activation-event.js';
import { VerticalEnum } from '../../src/enums/vertical.enum.js';

describe('TEST:V1:2 — every catalog key declares its four attributes', () => {
    it('declares scope, aggregation, enforcement and class from the closed lists', () => {
        for (const definition of CATALOG_KEY_DEFINITIONS) {
            expect(KEY_SCOPES).toContain(definition.scope);
            expect(AGGREGATION_STRATEGIES).toContain(definition.aggregationStrategy);
            expect(ENFORCEMENT_STRATEGIES).toContain(definition.enforcementStrategy);
            expect(KEY_CLASSES).toContain(definition.keyClass);
        }
    });

    it('has the closed lists the spec fixes', () => {
        expect([...AGGREGATION_STRATEGIES]).toEqual(['SUM', 'MAX', 'MIN', 'BEST_DECLARED']);
        expect([...KEY_CLASSES]).toEqual(['COMMERCIAL', 'BASE']);
        expect([...KEY_SCOPES]).toEqual(['vertical', 'global']);
    });

    it('carries names and attributes only: no value, price or assignment on any key', () => {
        const allowed = [
            'aggregationStrategy',
            'enforcementStrategy',
            'key',
            'keyClass',
            'kind',
            'scope'
        ];
        for (const definition of CATALOG_KEY_DEFINITIONS) {
            expect(Object.keys(definition).sort()).toEqual(allowed);
            expect(CatalogKeyDefinitionSchema.safeParse(definition).success).toBe(true);
        }
    });

    it('rejects a key that tries to carry a value, a price or a plan assignment', () => {
        const base = CATALOG_KEY_DEFINITIONS[0];
        for (const extra of [{ value: 20 }, { price: 1000 }, { plans: ['basic'] }]) {
            expect(CatalogKeyDefinitionSchema.safeParse({ ...base, ...extra }).success).toBe(false);
        }
    });

    it('rejects an attribute outside its closed list', () => {
        const base = CATALOG_KEY_DEFINITIONS[0];
        expect(CatalogKeyDefinitionSchema.safeParse({ ...base, keyClass: 'GRATIS' }).success).toBe(
            false
        );
        expect(
            CatalogKeyDefinitionSchema.safeParse({ ...base, aggregationStrategy: 'AVERAGE' })
                .success
        ).toBe(false);
    });

    it('has unique key names across entitlements and limits', () => {
        expect(new Set(CATALOG_KEY_NAMES).size).toBe(CATALOG_KEY_NAMES.length);
    });

    it('includes the carousel presence key and both floor keys', () => {
        expect(getCatalogKey({ key: 'partner_carousel_presence' })?.keyClass).toBe('COMMERCIAL');
        expect(getCatalogKey({ key: 'subscribe_to_plan' })?.keyClass).toBe('BASE');
        expect(getCatalogKey({ key: 'recover_own_listing' })?.keyClass).toBe('BASE');
    });

    it('keeps BASE for the two floor keys and the activation capability only', () => {
        const access = CATALOG_KEY_DEFINITIONS.filter((d) => d.keyClass === 'BASE').map(
            (d) => d.key
        );
        expect(access.sort()).toEqual([
            'activate_trial',
            'recover_own_listing',
            'subscribe_to_plan'
        ]);
    });

    it('keeps every metered limit at vertical scope', () => {
        const metered = CATALOG_KEY_DEFINITIONS.filter(
            (d) => d.kind === 'limit' && d.key.endsWith('_per_month')
        );
        expect(metered.length).toBeGreaterThan(0);
        for (const definition of metered) {
            expect(definition.scope).toBe('vertical');
        }
    });

    it('answers membership through the lookup helpers', () => {
        expect(isCatalogKey({ key: 'max_accommodations' })).toBe(true);
        expect(isCatalogKey({ key: 'not_a_key' })).toBe(false);
        expect(getCatalogKey({ key: 'not_a_key' })).toBeUndefined();
    });
});

describe('vertical activation events (DEC-TRIAL-006)', () => {
    it('declares an event or null for every vertical', () => {
        for (const vertical of Object.values(VerticalEnum)) {
            expect(vertical in VERTICAL_ACTIVATION_EVENT_BY_VERTICAL).toBe(true);
        }
    });

    it('maps the listing verticals to listing_published, tourist to the Empezar button, partner to none', () => {
        expect(VERTICAL_ACTIVATION_EVENT_BY_VERTICAL).toEqual({
            accommodation: 'listing_published',
            gastronomy: 'listing_published',
            experience: 'listing_published',
            tourist: 'start_button_pressed',
            partner: null
        });
    });

    it('only uses events from the closed catalog', () => {
        for (const event of Object.values(VERTICAL_ACTIVATION_EVENT_BY_VERTICAL)) {
            if (event !== null) expect(VERTICAL_ACTIVATION_EVENT_VALUES).toContain(event);
        }
        expect(VerticalActivationEventSchema.safeParse('user_signed_up').success).toBe(false);
    });
});

/**
 * Independent expected values for the semantically load-bearing keys. They are
 * written by hand from the spec, NOT derived from the catalog, so a lockstep
 * change of the code and the migration still turns this file red.
 */
const EXPECTED_BASE_KEYS = ['activate_trial', 'recover_own_listing', 'subscribe_to_plan'];
const EXPECTED_GLOBAL_KEYS = ['has_verification_badge', 'priority_support', 'vip_support'];
const EXPECTED_LISTING_CAPS = [
    'max_accommodations',
    'max_experiences',
    'max_gastronomies',
    'max_properties'
];
const EXPECTED_METERED_KEYS = [
    'max_ai_accommodation_import_per_month',
    'max_ai_chat_consumer_per_month',
    'max_ai_chat_experience_per_month',
    'max_ai_chat_gastronomy_per_month',
    'max_ai_chat_per_month',
    'max_ai_search_per_month',
    'max_ai_support_per_month',
    'max_ai_text_improve_per_month',
    'max_ai_translate_per_month'
];

describe('load-bearing key attributes are pinned to the spec', () => {
    const keysWhere = (predicate: (d: (typeof CATALOG_KEY_DEFINITIONS)[number]) => boolean) =>
        CATALOG_KEY_DEFINITIONS.filter(predicate)
            .map((d) => d.key)
            .sort();

    it('has exactly the BASE set, and every other key is COMMERCIAL', () => {
        expect(keysWhere((d) => d.keyClass === 'BASE')).toEqual(EXPECTED_BASE_KEYS);
        expect(keysWhere((d) => d.keyClass === 'COMMERCIAL')).toHaveLength(
            CATALOG_KEY_DEFINITIONS.length - EXPECTED_BASE_KEYS.length
        );
    });

    it('has exactly the expected global-scope keys', () => {
        expect(keysWhere((d) => d.scope === 'global')).toEqual(EXPECTED_GLOBAL_KEYS);
    });

    it('sums the listing caps and unpublishes the excess', () => {
        for (const key of EXPECTED_LISTING_CAPS) {
            const definition = getCatalogKey({ key });
            expect(definition?.kind).toBe('limit');
            expect(definition?.aggregationStrategy).toBe('SUM');
            expect(definition?.enforcementStrategy).toBe('UNPUBLISH');
        }
    });

    it('declares the metered monthly keys as vertical, summed, disabled on excess', () => {
        expect(keysWhere((d) => d.key.endsWith('_per_month'))).toEqual(EXPECTED_METERED_KEYS);
        for (const key of EXPECTED_METERED_KEYS) {
            expect(getCatalogKey({ key })).toMatchObject({
                kind: 'limit',
                scope: 'vertical',
                aggregationStrategy: 'SUM',
                enforcementStrategy: 'DISABLE',
                keyClass: 'COMMERCIAL'
            });
        }
    });
});
