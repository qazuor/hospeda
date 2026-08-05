import { describe, expect, it } from 'vitest';
import { HostTradeBenefitTypeEnum } from '../../../enums/host-trade-benefit-type.enum.js';
import { HostTradeCategoryEnum } from '../../../enums/host-trade-category.enum.js';
import {
    HOST_TRADE_OWNER_FORBIDDEN_FIELDS,
    HostTradeOwnerUpdateSchema
} from '../host-trade.owner.schema.js';

describe('HostTradeOwnerUpdateSchema — AC-9 server-side stripping', () => {
    it.each(
        HOST_TRADE_OWNER_FORBIDDEN_FIELDS
    )('should strip %s from a provider payload instead of accepting it', (field) => {
        // Arrange — a well-formed operational edit smuggling one field the
        // provider does not own. Values are chosen to be individually VALID
        // so nothing but the allowlist can be what rejects them.
        const smuggled: Record<string, unknown> = {
            id: '00000000-0000-4000-a000-000000000001',
            name: 'Renamed By Owner',
            slug: 'renamed-by-owner',
            category: HostTradeCategoryEnum.ELECTRICIDAD,
            destinationId: '00000000-0000-4000-a000-000000000002',
            isActive: false,
            ownerUserId: '00000000-0000-4000-a000-000000000003',
            benefitReviewState: 'pending',
            pendingBenefitType: HostTradeBenefitTypeEnum.TWO_FOR_ONE,
            pendingBenefitValue: 10,
            pendingBenefitText: 'sneaky',
            revokedAt: new Date().toISOString(),
            revokedById: '00000000-0000-4000-a000-000000000004',
            revokeReason: 'sneaky'
        };

        const payload = { contact: '+54 9 341 111 1111', [field]: smuggled[field] };

        // Act
        const result = HostTradeOwnerUpdateSchema.safeParse(payload);

        // Assert — parsing SUCCEEDS (a stripped key is not an error) but the
        // field is gone. This is the whole AC-9 mechanism: the update never
        // sees a value it must not apply.
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty(field);
            expect(result.data.contact).toBe('+54 9 341 111 1111');
        }
    });

    it('should keep every operational field a provider does own', () => {
        // Arrange
        const payload = {
            contact: 'wa.me/5493411111111',
            scheduleText: 'Lunes a viernes 8 a 18',
            is24h: false
        };

        // Act
        const result = HostTradeOwnerUpdateSchema.safeParse(payload);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).toEqual(payload);
        }
    });

    it('should accept a benefit edit, which the service routes to review', () => {
        // Arrange
        const payload = {
            benefitType: HostTradeBenefitTypeEnum.PERCENTAGE,
            benefitValue: 20,
            benefitText: 'Sólo días hábiles.'
        };

        // Act
        const result = HostTradeOwnerUpdateSchema.safeParse(payload);

        // Assert
        expect(result.success).toBe(true);
    });

    it('should reject an invalid benefit at the door, not in the review queue', () => {
        // Arrange — a PERCENTAGE with no value. Letting this through would put
        // an unrenderable benefit in front of an admin days later.
        const payload = { benefitType: HostTradeBenefitTypeEnum.PERCENTAGE };

        // Act
        const result = HostTradeOwnerUpdateSchema.safeParse(payload);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
            const messages = result.error.issues.map((issue) => issue.message);
            expect(messages).toContain('zodError.hostTrade.benefitValue.required');
        }
    });

    it('should accept an empty payload as a no-op', () => {
        // Every field is optional — a PATCH that changes nothing is not an error.
        expect(HostTradeOwnerUpdateSchema.safeParse({}).success).toBe(true);
    });

    it('should list every identity field the listing actually has', () => {
        // The forbidden list is only as good as its coverage: a field added to
        // HostTradeSchema that belongs to the admin, but is never added here,
        // would be silently unprotected. This pins the ones that exist today so
        // widening the entity forces a conscious decision about the new field.
        expect(HOST_TRADE_OWNER_FORBIDDEN_FIELDS).toContain('name');
        expect(HOST_TRADE_OWNER_FORBIDDEN_FIELDS).toContain('slug');
        expect(HOST_TRADE_OWNER_FORBIDDEN_FIELDS).toContain('category');
        expect(HOST_TRADE_OWNER_FORBIDDEN_FIELDS).toContain('destinationId');
        expect(HOST_TRADE_OWNER_FORBIDDEN_FIELDS).toContain('isActive');
    });
});
