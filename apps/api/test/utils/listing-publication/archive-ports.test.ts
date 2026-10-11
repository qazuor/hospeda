import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getListingPublicationPorts, transaction, listRetentionCandidates } = vi.hoisted(() => ({
    getListingPublicationPorts: vi.fn(() => ({
        unitOfWork: {},
        afterCommit: {},
        billing: { coverage: vi.fn(), retentionStopped: vi.fn() },
        clock: { now: vi.fn() }
    })),
    transaction: vi.fn(),
    listRetentionCandidates: vi.fn()
}));
vi.mock('../../../src/utils/listing-publication/ports.js', () => ({ getListingPublicationPorts }));
vi.mock('@repo/db', () => ({
    getDb: () => ({ transaction }),
    listingRetentionModel: { listRetentionCandidates }
}));

import { getListingArchivePorts } from '../../../src/utils/listing-publication/archive-ports';

describe('production inactivity archive ports', () => {
    beforeEach(() => {
        transaction.mockImplementation((callback) => callback('transaction'));
        listRetentionCandidates.mockReset();
    });

    it('TEST:V6:8/9 delegates due population arguments to the retention model', async () => {
        const input = { now: new Date('2026-10-11T05:30:00Z'), after: null, limit: 200 };
        listRetentionCandidates.mockResolvedValue({ items: [], next: null });
        const ports = getListingArchivePorts();
        await ports.population.listDue(input);
        expect(listRetentionCandidates).toHaveBeenCalledWith({ ...input, tx: 'transaction' });
        expect(ports.billing.retentionStopped).toBeDefined();
    });
});
