import type { Client, ClientIdType, UserIdType } from '@repo/schemas';
import { getMockId } from './utilsFactory';

/**
 * Factory para crear clients mock para testing
 */
export function createMockClient(overrides?: Partial<Client>): Client {
    const defaults: Client = {
        id: getMockId('client', 'c1') as ClientIdType,
        name: 'Test Client',
        billingEmail: 'billing@testclient.com',
        userId: getMockId('user', 'u1') as UserIdType,
        taxId: null,
        address: null,
        phone: null,
        billingAddress: null,
        paymentMethodId: null,
        defaultCurrency: 'ARS',
        billingCycle: 'MONTHLY',
        autoRenew: true,
        isActive: true,
        notes: null,
        metadata: null,
        adminInfo: null,

        // Base audit fields
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: getMockId('user') as string,
        updatedById: getMockId('user') as string,
        deletedAt: null,
        deletedById: null
    };

    return { ...defaults, ...overrides };
}

/**
 * Factory para crear múltiples clients
 */
export function createMockClients(count: number, overrides?: Partial<Client>): Client[] {
    return Array.from({ length: count }, (_, i) =>
        createMockClient({
            ...overrides,
            id: getMockId('client', `c${i + 1}`) as ClientIdType,
            name: `Test Client ${i + 1}`,
            billingEmail: `billing${i + 1}@testclient.com`
        })
    );
}
