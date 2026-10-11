import { describe, expect, it } from 'vitest';
import { runStep4b } from '../../cutover/run-step-4b.ts';
import { createFakeProvider } from './fake-provider.ts';

const payment = {
    amountArs: 20,
    cardToken: 'secret-card-token',
    paymentMethodId: 'visa',
    payerEmail: 'owner@example.com'
};
const now = () => new Date('2026-10-11T12:34:56.789Z');

function setup({
    probeSeenAt = 1,
    ipnSeenAt = 1,
    readerError = false,
    paymentIds,
    createdPaymentStatus = 'approved',
    stuckIds,
    refuseCreate
}: {
    probeSeenAt?: number;
    ipnSeenAt?: number;
    readerError?: boolean;
    paymentIds?: readonly string[];
    createdPaymentStatus?: string;
    stuckIds?: readonly string[];
    refuseCreate?: { probe?: boolean; payment?: boolean };
} = {}) {
    const fake = createFakeProvider({
        objects: [],
        paymentIds,
        createdPaymentStatus,
        stuckIds,
        refuseCreate
    });
    const seen: Record<string, number> = { WEBHOOKS: 0, IPN: 0 };
    const reader = async ({
        channel,
        resourceId
    }: {
        channel: 'IPN' | 'WEBHOOKS';
        resourceId: string;
    }) => {
        fake.calls.push(`READ ${channel} ${resourceId}`);
        seen[channel] = (seen[channel] ?? 0) + 1;
        if (readerError) throw new Error('reader unavailable');
        return seen[channel] >= (channel === 'WEBHOOKS' ? probeSeenAt : ipnSeenAt);
    };
    return { fake, seen, reader };
}

describe('TEST:U3:8 the step-4b delivery probe (AC:U3:7)', () => {
    it('creates the probe directly, sees delivery, cancels, re-reads, and records its id', async () => {
        // Arrange
        const { fake, reader } = setup();
        // Act
        const result = await runStep4b({
            api: fake.api,
            readDelivery: reader,
            payment,
            sleep: async () => {},
            now
        });
        // Assert
        expect(fake.calls).toEqual([
            'CREATE probe probe-1',
            'GET preapproval probe-1',
            'READ WEBHOOKS probe-1',
            'CANCEL preapproval probe-1',
            'GET preapproval probe-1',
            'CREATE payment pay-1',
            'GET payment pay-1',
            'READ IPN pay-1',
            'GET payment pay-1',
            'REFUND payment pay-1',
            'GET refund refund-1'
        ]);
        expect(result.ok).toBe(true);
        expect(result.manifest).toMatchObject({
            step: '4b',
            outcome: 'ok',
            probeId: 'probe-1',
            paymentId: 'pay-1',
            refundId: 'refund-1'
        });
    });

    it('waits for the third probe read before cancelling', async () => {
        // Arrange
        const { fake, reader } = setup({ probeSeenAt: 3 });
        const sleeps: number[] = [];
        // Act
        await runStep4b({
            api: fake.api,
            readDelivery: reader,
            payment,
            sleep: async (ms) => {
                sleeps.push(ms);
            },
            deliveryWaitsMs: [2_000, 3_000, 5_000],
            now
        });
        // Assert
        expect(sleeps.slice(0, 2)).toEqual([2_000, 3_000]);
        expect(fake.calls.indexOf('CANCEL preapproval probe-1')).toBeGreaterThan(
            fake.calls.indexOf('READ WEBHOOKS probe-1')
        );
        expect(fake.calls.filter((call) => call === 'READ WEBHOOKS probe-1')).toHaveLength(3);
    });

    it('checkpoints each created id before its next provider read or cancellation', async () => {
        // Arrange
        const { fake, reader } = setup();
        const snapshots: { manifest: unknown; callCount: number }[] = [];
        // Act
        await runStep4b({
            api: fake.api,
            readDelivery: reader,
            payment,
            sleep: async () => {},
            now,
            onCheckpoint: (manifest) => {
                snapshots.push({ manifest, callCount: fake.calls.length });
                return true;
            }
        });
        // Assert
        const probe = snapshots.find(
            (s) => (s.manifest as { probeId?: string }).probeId === 'probe-1'
        );
        const pay = snapshots.find(
            (s) => (s.manifest as { paymentId?: string }).paymentId === 'pay-1'
        );
        const refund = snapshots.find(
            (s) => (s.manifest as { refundId?: string }).refundId === 'refund-1'
        );
        expect(probe?.callCount).toBe(1);
        expect(pay?.callCount).toBe(fake.calls.indexOf('CREATE payment pay-1') + 1);
        expect(refund?.callCount).toBe(fake.calls.indexOf('REFUND payment pay-1') + 1);
    });

    it('cancels and re-reads a probe even when its delivery never appears, then skips payment', async () => {
        // Arrange
        const { fake, reader } = setup({ probeSeenAt: Number.POSITIVE_INFINITY });
        // Act
        const result = await runStep4b({
            api: fake.api,
            readDelivery: reader,
            payment,
            sleep: async () => {},
            deliveryWaitsMs: [],
            now
        });
        // Assert
        expect(result.ok).toBe(false);
        expect(result.manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'DELIVERY_NOT_SEEN', id: 'probe-1' })
        );
        expect(fake.state.get('probe-1')?.status).toBe('cancelled');
        expect(fake.calls).toContain('GET preapproval probe-1');
        expect(fake.calls.some((call) => call.startsWith('CREATE payment'))).toBe(false);
    });

    it('fails a stuck probe without creating a payment', async () => {
        // Arrange
        const { fake, reader } = setup({ stuckIds: ['probe-1'] });
        // Act
        const result = await runStep4b({
            api: fake.api,
            readDelivery: reader,
            payment,
            sleep: async () => {},
            backoffMs: [],
            now
        });
        // Assert
        expect(result.manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'NOT_CANCELLED', id: 'probe-1' })
        );
        expect(fake.calls.some((call) => call.startsWith('CREATE payment'))).toBe(false);
    });
});

describe('AC:U3:8 the small IPN payment, against a simulated delivery reader', () => {
    it('does not refund a payment that is rejected', async () => {
        // Arrange
        const { fake, reader } = setup({ createdPaymentStatus: 'rejected' });
        // Act
        const result = await runStep4b({
            api: fake.api,
            readDelivery: reader,
            payment,
            sleep: async () => {},
            backoffMs: [],
            now
        });
        // Assert
        expect(result.manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'PAYMENT_NOT_APPROVED', id: 'pay-1' })
        );
        expect(fake.calls.some((call) => call.startsWith('REFUND'))).toBe(false);
    });

    it('fails when IPN delivery is absent but still refunds and re-reads the payment', async () => {
        // Arrange
        const { fake, reader } = setup({ ipnSeenAt: Number.POSITIVE_INFINITY });
        // Act
        const result = await runStep4b({
            api: fake.api,
            readDelivery: reader,
            payment,
            sleep: async () => {},
            deliveryWaitsMs: [],
            now
        });
        // Assert
        expect(result.ok).toBe(false);
        expect(result.manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'DELIVERY_NOT_SEEN', id: 'pay-1' })
        );
        expect(fake.calls.slice(-3)).toEqual([
            'GET payment pay-1',
            'REFUND payment pay-1',
            'GET refund refund-1'
        ]);
        expect(result.manifest.refundId).toBe('refund-1');
    });

    it('requires the delivery reader to match the exact payment id', async () => {
        // Arrange
        const { fake, reader } = setup({ paymentIds: ['pay-2'] });
        const exactIdReader = async (input: { channel: 'IPN' | 'WEBHOOKS'; resourceId: string }) =>
            (await reader(input)) && (input.channel === 'WEBHOOKS' || input.resourceId === 'pay-1');
        // Act
        const result = await runStep4b({
            api: fake.api,
            readDelivery: exactIdReader,
            payment,
            sleep: async () => {},
            deliveryWaitsMs: [],
            now
        });
        // Assert
        expect(result.manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'DELIVERY_NOT_SEEN', id: 'pay-2' })
        );
    });

    it('records reader errors as NEW_DB_ERROR and fails the run', async () => {
        // Arrange
        const { fake, reader } = setup({ readerError: true });
        // Act
        const result = await runStep4b({
            api: fake.api,
            readDelivery: reader,
            payment,
            sleep: async () => {},
            deliveryWaitsMs: [],
            now
        });
        // Assert
        expect(result.ok).toBe(false);
        expect(result.manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'NEW_DB_ERROR' })
        );
    });

    it('stops before provider calls when the first checkpoint fails', async () => {
        // Arrange
        const { fake, reader } = setup();
        // Act
        const result = await runStep4b({
            api: fake.api,
            readDelivery: reader,
            payment,
            sleep: async () => {},
            now,
            onCheckpoint: () => false
        });
        // Assert
        expect(fake.calls).toEqual([]);
        expect(result.manifest.failures).toContainEqual(
            expect.objectContaining({ code: 'MANIFEST_WRITE_FAILED' })
        );
    });

    it('keeps person data out of every checkpoint and manifest while sending it only to the provider', async () => {
        // Arrange
        const { fake, reader } = setup();
        const serialized: string[] = [];
        // Act
        const result = await runStep4b({
            api: fake.api,
            readDelivery: reader,
            payment,
            sleep: async () => {},
            now,
            onCheckpoint: (manifest) => {
                serialized.push(JSON.stringify(manifest));
                return true;
            }
        });
        serialized.push(JSON.stringify(result.manifest));
        // Assert
        expect(
            serialized.every(
                (value) =>
                    !value.includes('owner@example.com') && !value.includes('secret-card-token')
            )
        ).toBe(true);
        expect(fake.lastCreateInputs.probe).toMatchObject({ payerEmail: 'owner@example.com' });
        expect(fake.lastCreateInputs.payment).toMatchObject({
            payerEmail: 'owner@example.com',
            cardToken: 'secret-card-token'
        });
    });

    it('reports the idempotency key when the probe create is refused', async () => {
        // Arrange
        const { fake, reader } = setup({ refuseCreate: { probe: true } });
        // Act
        const result = await runStep4b({
            api: fake.api,
            readDelivery: reader,
            payment,
            sleep: async () => {},
            now
        });
        // Assert
        expect(result.manifest.failures[0]).toMatchObject({
            code: 'PROVIDER_ERROR',
            detail: expect.stringContaining('cutover-4b-probe-2026-10-11T123456789Z')
        });
        expect(result.manifest.probeId).toBeUndefined();
        expect(fake.calls.some((call) => call.startsWith('CREATE payment'))).toBe(false);
    });
});
