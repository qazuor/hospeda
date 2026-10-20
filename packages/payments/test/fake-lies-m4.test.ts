import { type AdjustableClock, createAdjustableClock } from '@repo/test-clock';
import { beforeEach, describe, expect, it } from 'vitest';
import { FAKE_LIES, FakePaymentProvider } from '../src/fake/index';
import {
    type AuthorizationStatus,
    type AuthorizeInput,
    assertFreshForAct,
    PaymentProviderError,
    type ProviderRead,
    ProviderReadRejectedError
} from '../src/index';

const clockStart = new Date('2026-10-01T03:00:00.000Z');
const baseInput: AuthorizeInput = {
    reference: 'm4-row-1',
    amount: { amountMinor: 180_000, currency: 'ARS' },
    cadence: { everyMonths: 1 },
    reason: 'Plan mensual',
    returnUrl: 'https://hospeda.test/return'
};
const defenseOf = ({ lie }: { readonly lie: string }): string | undefined =>
    FAKE_LIES.find((row) => row.id === lie)?.defenseTest;

let clock: AdjustableClock;

beforeEach(() => {
    clock = createAdjustableClock({ start: clockStart });
});

async function seed({ fake }: { readonly fake: FakePaymentProvider }) {
    const ids: string[] = [];
    const refs = ['m4-row-1', 'm4-row-2', 'm4-row-3', 'm4-row-4', 'm4-row-5'];
    for (const [index, reference] of refs.entries()) {
        const { authorizationId } = await fake.authorize({ ...baseInput, reference });
        if (index < 3) await fake.approve({ authorizationId });
        ids.push(authorizationId);
    }
    return { ids, refs };
}

describe('TEST:B1:13 M4 search defense (supports TEST:B11:1)', () => {
    it('returns a plausible partial result with only summary fields and restores exact search when honest', async () => {
        const fake = new FakePaymentProvider({ clock });
        const { ids, refs } = await seed({ fake });

        const byReference = await fake.searchAuthorizations({ reference: refs[0] });
        expect(byReference.authorizations).toHaveLength(5);
        const active = await fake.searchAuthorizations({ status: 'active' });
        expect(active.authorizations).toHaveLength(2);
        expect(active.authorizations.map(({ authorizationId }) => authorizationId)).toEqual([
            ids[0],
            ids[2]
        ]);
        for (const summary of byReference.authorizations) {
            expect(Object.keys(summary).sort()).toEqual([
                'authorizationId',
                'createdAt',
                'reference',
                'status'
            ]);
        }
        const read = await fake.readAuthorization({ authorizationId: ids[0]! });
        expect(read.snapshot).toHaveProperty('amount');
        expect(read.snapshot).toHaveProperty('cadence');
        expect(byReference.authorizations[0]).not.toHaveProperty('amount');
        expect(byReference.authorizations[0]).not.toHaveProperty('cadence');

        expect(defenseOf({ lie: 'M4' })).toBe('TEST:B11:1');
        const honest = new FakePaymentProvider({
            clock,
            honestAbout: [{ lie: 'M4', why: 'the honest path: the search matches exactly' }]
        });
        await seed({ fake: honest });
        expect(
            (await honest.searchAuthorizations({ reference: refs[0] })).authorizations
        ).toHaveLength(1);
        expect(
            (await honest.searchAuthorizations({ status: 'active' })).authorizations
        ).toHaveLength(3);

        const forged = byReference as unknown as ProviderRead<unknown>;
        expect(() =>
            assertFreshForAct({
                read: forged,
                act: { kind: 'decision', startedAt: clock.now() }
            })
        ).toThrow(ProviderReadRejectedError);
        try {
            assertFreshForAct({
                read: forged,
                act: { kind: 'decision', startedAt: clock.now() }
            });
        } catch (error) {
            expect(error).toMatchObject({ reason: 'NOT_A_PROVIDER_READ' });
        }
    });

    it('rejects a status outside the domain with INVALID_INPUT', async () => {
        const fake = new FakePaymentProvider({ clock });
        let failure: unknown;
        try {
            await fake.searchAuthorizations({ status: 'cancelado' as AuthorizationStatus });
        } catch (error) {
            failure = error;
        }
        expect(failure).toBeInstanceOf(PaymentProviderError);
        expect(failure).toMatchObject({ code: 'INVALID_INPUT' });
    });
});
