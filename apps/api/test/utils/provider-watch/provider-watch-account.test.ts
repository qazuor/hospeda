import type { WatchTransport } from '@repo/payments';
import { describe, expect, it } from 'vitest';
import { readProviderAccount } from '../../../src/utils/provider-watch/provider-watch-account';

const answer =
    (status: number, body: unknown): WatchTransport =>
    async () => ({ status, body });

describe('readProviderAccount', () => {
    it('reads the id and nickname of a test account for the sandbox', async () => {
        const result = await readProviderAccount({
            transport: answer(200, { id: 900000001, nickname: 'TESTUSER1', tags: ['test_user'] }),
            account: 'sandbox'
        });
        expect(result).toEqual({
            ok: true,
            account: { id: '900000001', nickname: 'TESTUSER1', isTestAccount: true }
        });
    });

    it('reads a production account for production, with a null nickname when absent', async () => {
        const result = await readProviderAccount({
            transport: answer(200, { id: '100000001', tags: ['normal'] }),
            account: 'production'
        });
        expect(result).toEqual({
            ok: true,
            account: { id: '100000001', nickname: null, isTestAccount: false }
        });
    });

    it('refuses a test account for production and a real account for the sandbox', async () => {
        await expect(
            readProviderAccount({
                transport: answer(200, { id: 1, tags: ['test_user'] }),
                account: 'production'
            })
        ).resolves.toEqual({ ok: false, refusal: 'WRONG_KIND' });
        await expect(
            readProviderAccount({
                transport: answer(200, { id: 1, tags: [] }),
                account: 'sandbox'
            })
        ).resolves.toEqual({ ok: false, refusal: 'WRONG_KIND' });
    });

    it.each([
        ['a failed status', 500, { id: 1 }],
        ['no body', 200, undefined],
        ['a null body', 200, null],
        ['no id', 200, { tags: [] }],
        ['an id that is neither a number nor a string', 200, { id: {}, tags: [] }],
        ['tags that are not a list', 200, { id: 1, tags: 'test_user' }]
    ])('cannot confirm the account on %s', async (_name, status, body) => {
        await expect(
            readProviderAccount({ transport: answer(status, body), account: 'production' })
        ).resolves.toEqual({ ok: false, refusal: 'UNREADABLE' });
    });
});
