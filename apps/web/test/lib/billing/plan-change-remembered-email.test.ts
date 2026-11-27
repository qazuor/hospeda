import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDeclaredPayerEmail } from '@/lib/billing/plan-change-offer';

const read = vi.hoisted(() => vi.fn());
const readRememberedPayerEmail = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    billingSubscriptionApi: { read, readRememberedPayerEmail }
}));

beforeEach(() => vi.resetAllMocks());

describe('HOS-2616 plan change prefill falls back to the remembered payer email', () => {
    it('prefers the email declared on the subscription', async () => {
        read.mockResolvedValue({ ok: true, data: { declaredPayerEmail: 'sub@example.test' } });
        readRememberedPayerEmail.mockResolvedValue({
            ok: true,
            data: { rememberedPayerEmail: 'mp@example.test' }
        });

        await expect(loadDeclaredPayerEmail({ subscriptionId: 's1' })).resolves.toBe(
            'sub@example.test'
        );
    });

    it('uses the remembered email when the subscription declared none', async () => {
        read.mockResolvedValue({ ok: true, data: { declaredPayerEmail: null } });
        readRememberedPayerEmail.mockResolvedValue({
            ok: true,
            data: { rememberedPayerEmail: 'mp@example.test' }
        });

        await expect(loadDeclaredPayerEmail({ subscriptionId: 's1' })).resolves.toBe(
            'mp@example.test'
        );
    });

    it('stays empty when neither is known or the read fails', async () => {
        read.mockResolvedValue({ ok: true, data: { declaredPayerEmail: null } });
        readRememberedPayerEmail.mockRejectedValue(new Error('network'));

        await expect(loadDeclaredPayerEmail({ subscriptionId: 's1' })).resolves.toBe('');
    });
});
