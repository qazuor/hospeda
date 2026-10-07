import { describe, expect, it } from 'vitest';
import { ProductDomainEnum } from '../../src/enums/product-domain.enum.js';
import { VerticalEnum } from '../../src/enums/vertical.enum.js';
import { VerticalEnumSchema } from '../../src/enums/vertical.schema.js';

describe('VerticalEnum', () => {
    it('has exactly the five verticals', () => {
        expect(Object.values(VerticalEnum).sort()).toEqual([
            'accommodation',
            'experience',
            'gastronomy',
            'partner',
            'tourist'
        ]);
    });

    it('is separate from ProductDomainEnum, which still carries addon', () => {
        expect(Object.values(ProductDomainEnum)).toContain('addon');
        expect(Object.values(VerticalEnum)).not.toContain('addon');
    });

    it('validates members and rejects anything else', () => {
        for (const value of Object.values(VerticalEnum)) {
            expect(VerticalEnumSchema.safeParse(value).success).toBe(true);
        }
        for (const value of ['addon', 'commerce_x', '', null, undefined, 1]) {
            expect(VerticalEnumSchema.safeParse(value).success).toBe(false);
        }
    });
});
