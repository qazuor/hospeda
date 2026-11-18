/**
 * Regression (HOS-919): `host_trades.category` is nullable and nothing writes it
 * any more, so a real DB row carries `category: null`. A schema that only
 * allows `undefined` rejects it and every read response 500s.
 */
import { describe, expect, it } from 'vitest';
import { AllianceLeadSchema } from '../../alliance-lead/alliance-lead.schema.js';
import { HostTradeUsageProviderRefSchema } from '../../host-trade-usage/host-trade-usage.access.schema.js';
import { HostTradeAdminSchema, HostTradePublicSchema } from '../host-trade.http.schema.js';
import { HostTradeOwnerViewSchema } from '../host-trade.owner.schema.js';
import { HostTradeSchema } from '../host-trade.schema.js';

const ROW = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    slug: 'plomero-juan-perez',
    name: 'Plomero Juan Pérez',
    category: null,
    contact: '+5493442123456',
    benefit: '10% de descuento',
    destinationId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    is24h: false,
    isActive: true,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date('2024-01-15T10:00:00Z'),
    createdById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    updatedById: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    deletedAt: null
};

describe('host trade read schemas with a NULL legacy category', () => {
    it.each([
        ['HostTradeSchema', HostTradeSchema],
        ['HostTradeAdminSchema', HostTradeAdminSchema],
        ['HostTradePublicSchema', HostTradePublicSchema],
        ['HostTradeOwnerViewSchema', HostTradeOwnerViewSchema]
    ])('%s parses a row whose category is null', (_name, schema) => {
        const result = schema.safeParse(ROW);
        expect(result.success ? [] : result.error.issues).toEqual([]);
    });

    it('HostTradeUsageProviderRefSchema parses a provider ref whose category is null', () => {
        const result = HostTradeUsageProviderRefSchema.safeParse({
            id: ROW.id,
            slug: ROW.slug,
            name: ROW.name,
            category: null
        });
        expect(result.success ? [] : result.error.issues).toEqual([]);
    });

    it('AllianceLeadSchema parses a new lead that only has categorySlugs', () => {
        const result = AllianceLeadSchema.safeParse({
            id: ROW.id,
            kind: 'service_provider',
            contactName: 'Juan Perez',
            email: 'juan@example.com',
            message: 'Quiero sumarme al directorio',
            status: 'pending',
            category: null,
            categorySlugs: ['plomeria'],
            createdAt: ROW.createdAt,
            updatedAt: ROW.updatedAt,
            createdById: ROW.createdById,
            updatedById: ROW.updatedById,
            deletedAt: null
        });
        expect(result.success ? [] : result.error.issues).toEqual([]);
    });
});
