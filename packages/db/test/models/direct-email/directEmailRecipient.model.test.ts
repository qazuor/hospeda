import { DirectEmailRecipientStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import type { DirectEmailProviderEvent } from '../../../src/models/direct-email/directEmailRecipient.model.ts';
import { DirectEmailRecipientModel } from '../../../src/models/direct-email/directEmailRecipient.model.ts';
import type { DrizzleClient } from '../../../src/types.ts';

const AT = new Date('2026-11-28T10:00:00Z');

/** Fake client: records the SET clause and answers the given row from `returning()`. */
function buildClient(row: Record<string, unknown> | undefined) {
    const set = vi.fn();
    const where = vi.fn();
    const chain = {
        set: (value: unknown) => {
            set(value);
            return chain;
        },
        where: (value: unknown) => {
            where(value);
            return chain;
        },
        returning: async () => (row ? [row] : [])
    };
    const client = { update: () => chain } as unknown as DrizzleClient;
    return { client, set, where };
}

describe('DirectEmailRecipientModel.applyProviderEvent (HOS-2685, AC-9)', () => {
    const model = new DirectEmailRecipientModel();

    it.each<[DirectEmailProviderEvent, Record<string, unknown>]>([
        ['delivered', { status: DirectEmailRecipientStatusEnum.DELIVERED, deliveredAt: AT }],
        ['opened', { status: DirectEmailRecipientStatusEnum.OPENED, openedAt: AT }],
        ['hard_bounce', { status: DirectEmailRecipientStatusEnum.BOUNCED, bouncedAt: AT }],
        ['soft_bounce', { status: DirectEmailRecipientStatusEnum.BOUNCED, bouncedAt: AT }]
    ])('maps %s onto its status and timestamp', async (event, expectedSet) => {
        // Arrange
        const { client, set, where } = buildClient({ id: 'r1' });

        // Act
        const result = await model.applyProviderEvent(
            { providerMessageId: '<m1>', event, at: AT },
            client
        );

        // Assert
        expect(set).toHaveBeenCalledWith(expectedSet);
        expect(where).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ id: 'r1' });
    });

    it('returns null when no row moved (unknown id, duplicate or out-of-order event)', async () => {
        const { client } = buildClient(undefined);
        const result = await model.applyProviderEvent(
            { providerMessageId: '<none>', event: 'delivered', at: AT },
            client
        );
        expect(result).toBeNull();
    });
});
