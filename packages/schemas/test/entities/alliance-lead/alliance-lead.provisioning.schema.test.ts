import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';
import {
    ALLIANCE_LEAD_PROVISION_SKIP_REASONS,
    AllianceLeadProvisioningOutcomeSchema,
    AllianceLeadWithProvisioningSchema
} from '../../../src/entities/alliance-lead/alliance-lead.provisioning.schema.js';
import { AllianceLeadSchema } from '../../../src/entities/alliance-lead/alliance-lead.schema.js';

const lead = () => ({
    id: faker.string.uuid(),
    kind: 'service_provider' as const,
    contactName: 'Juan Perez',
    email: 'juan@example.com',
    phone: '+549341234567',
    message: 'Quiero sumarme como aliado de la plataforma.',
    status: 'approved' as const,
    adminNote: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: null,
    updatedById: null,
    deletedAt: null,
    deletedById: null
});

describe('AllianceLeadProvisioningOutcomeSchema', () => {
    it('accepts a provisioned outcome with hostTradeId', () => {
        const r = AllianceLeadProvisioningOutcomeSchema.safeParse({
            provisioned: true,
            hostTradeId: faker.string.uuid()
        });
        expect(r.success).toBe(true);
    });

    it('rejects a provisioned outcome without hostTradeId', () => {
        expect(AllianceLeadProvisioningOutcomeSchema.safeParse({ provisioned: true }).success).toBe(
            false
        );
    });

    it('rejects a provisioned outcome carrying a reason', () => {
        const r = AllianceLeadProvisioningOutcomeSchema.safeParse({
            provisioned: true,
            hostTradeId: faker.string.uuid(),
            reason: 'no-active-category'
        });
        expect(r.success).toBe(false);
    });

    it.each(ALLIANCE_LEAD_PROVISION_SKIP_REASONS)('accepts a skip with reason %s', (reason) => {
        expect(
            AllianceLeadProvisioningOutcomeSchema.safeParse({ provisioned: false, reason }).success
        ).toBe(true);
    });

    it('rejects an unknown reason', () => {
        expect(
            AllianceLeadProvisioningOutcomeSchema.safeParse({ provisioned: false, reason: 'nope' })
                .success
        ).toBe(false);
    });
});

describe('AllianceLeadWithProvisioningSchema', () => {
    it('validates a lead without provisioning (additive)', () => {
        expect(AllianceLeadWithProvisioningSchema.safeParse(lead()).success).toBe(true);
        expect(AllianceLeadSchema.safeParse(lead()).success).toBe(true);
    });

    it('validates a lead with a provisioning outcome', () => {
        const r = AllianceLeadWithProvisioningSchema.safeParse({
            ...lead(),
            provisioning: { provisioned: false, reason: 'no-active-category' }
        });
        expect(r.success).toBe(true);
    });
});
