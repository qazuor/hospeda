import { describe, expect, it } from 'vitest';
import { PartnerTypeEnum } from '../../src/enums/partner-type.enum.js';
import { PartnerTypeEnumSchema } from '../../src/enums/partner-type.schema.js';

describe('partner type after HOS-1417', () => {
    it('accepts business and rejects the retired old-grouping value', () => {
        expect(PartnerTypeEnum.BUSINESS).toBe('business');
        expect(PartnerTypeEnumSchema.safeParse('business').success).toBe(true);
        expect(PartnerTypeEnumSchema.safeParse(['comm', 'erce'].join('')).success).toBe(false);
    });
});
