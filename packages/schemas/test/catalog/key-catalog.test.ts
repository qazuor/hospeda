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
        expect([...KEY_CLASSES]).toEqual(['COMERCIAL', 'DE_ACCESO']);
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
        expect(getCatalogKey({ key: 'partner_carousel_presence' })?.keyClass).toBe('COMERCIAL');
        expect(getCatalogKey({ key: 'subscribe_to_plan' })?.keyClass).toBe('DE_ACCESO');
        expect(getCatalogKey({ key: 'recover_own_listing' })?.keyClass).toBe('DE_ACCESO');
    });

    it('keeps DE_ACCESO for the two floor keys only', () => {
        const access = CATALOG_KEY_DEFINITIONS.filter((d) => d.keyClass === 'DE_ACCESO').map(
            (d) => d.key
        );
        expect(access.sort()).toEqual(['recover_own_listing', 'subscribe_to_plan']);
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
