/** HOS-1512 N3: the amount to authorize is the exact sum of the money-moving measurements. */
import type { WatchEntry } from '@repo/payments';
import { describe, expect, it } from 'vitest';
import {
    checkAuthorizedAmount,
    previewAuthorization
} from '../../../src/utils/provider-watch/provider-watch-authorization';

const entry = (args: Partial<WatchEntry> & Pick<WatchEntry, 'id'>): WatchEntry => ({
    accounts: ['sandbox', 'production'],
    effect: 'moves-money',
    maxChargeMinor: 50000,
    expected: 'x',
    measure: async () => 'x',
    ...args
});

const CATALOG: readonly WatchEntry[] = [
    entry({ id: 'M1', maxChargeMinor: 50000 }),
    entry({ id: 'M2', maxChargeMinor: 100000, accounts: ['production'] }),
    entry({ id: 'M3', maxChargeMinor: 70000, accounts: ['sandbox'] }),
    entry({ id: 'RP7', effect: 'read', maxChargeMinor: undefined as never }),
    entry({ id: 'RP8', effect: 'mutates', maxChargeMinor: undefined as never })
];

describe('previewAuthorization', () => {
    it('sums only the money-moving measurements of the account', () => {
        expect(previewAuthorization({ account: 'production', catalog: CATALOG })).toEqual({
            ok: true,
            preview: {
                expectedMaxChargeMinor: 150000,
                measurements: [
                    { id: 'M1', maxChargeMinor: 50000 },
                    { id: 'M2', maxChargeMinor: 100000 }
                ]
            }
        });
        expect(previewAuthorization({ account: 'sandbox', catalog: CATALOG })).toEqual({
            ok: true,
            preview: {
                expectedMaxChargeMinor: 120000,
                measurements: [
                    { id: 'M1', maxChargeMinor: 50000 },
                    { id: 'M3', maxChargeMinor: 70000 }
                ]
            }
        });
    });

    it('answers 0 for an account with no money-moving measurement, which is the shipped catalog today', () => {
        expect(previewAuthorization({ account: 'production' })).toEqual({
            ok: true,
            preview: { expectedMaxChargeMinor: 0, measurements: [] }
        });
    });

    it('refuses to preview a broken catalog whose sum would read 0', () => {
        // A money-moving measurement with no maximum: the sum treats it as 0, which would pass
        // for a catalog with no money-moving measurement.
        const broken = [entry({ id: 'M1', maxChargeMinor: undefined as never })];
        expect(previewAuthorization({ account: 'production', catalog: broken })).toEqual({
            ok: false,
            problems: ['M1: moves money without an integer maximum charge above zero']
        });
    });
});

describe('checkAuthorizedAmount', () => {
    it('accepts exactly the sum', () => {
        expect(
            checkAuthorizedAmount({ account: 'production', amountMinor: 150000, catalog: CATALOG })
        ).toEqual({ ok: true });
    });

    it.each([
        150001, 149999, 1500000, 15000
    ])('refuses %s and says what would be accepted', (amountMinor) => {
        expect(
            checkAuthorizedAmount({ account: 'production', amountMinor, catalog: CATALOG })
        ).toEqual({
            ok: false,
            refusal: 'AMOUNT_DIFFERS',
            expectedMinor: 150000
        });
    });

    it('accepts exactly 0 when there is no money-moving measurement (sum 0, a read-only battery)', () => {
        expect(checkAuthorizedAmount({ account: 'production', amountMinor: 0 })).toEqual({
            ok: true
        });
        expect(
            checkAuthorizedAmount({
                account: 'production',
                amountMinor: 0,
                catalog: [entry({ id: 'RP7', effect: 'read' })]
            })
        ).toEqual({ ok: true });
    });

    it('refuses any other amount when the sum is 0', () => {
        expect(checkAuthorizedAmount({ account: 'production', amountMinor: 100 })).toEqual({
            ok: false,
            refusal: 'AMOUNT_DIFFERS',
            expectedMinor: 0
        });
    });

    it('refuses to authorize 0 against a broken catalog whose sum would read 0', () => {
        expect(
            checkAuthorizedAmount({
                account: 'production',
                amountMinor: 0,
                catalog: [entry({ id: 'M1', maxChargeMinor: undefined as never })]
            })
        ).toEqual({
            ok: false,
            refusal: 'CATALOG_INVALID',
            problems: ['M1: moves money without an integer maximum charge above zero']
        });
    });

    it('refuses any amount against an invalid catalog', () => {
        expect(
            checkAuthorizedAmount({
                account: 'production',
                amountMinor: 50000,
                catalog: [entry({ id: 'NOT-A-ROW' })]
            })
        ).toMatchObject({ ok: false, refusal: 'CATALOG_INVALID' });
    });

    it('refuses an authorization of 0 when the sum is greater than 0', () => {
        expect(
            checkAuthorizedAmount({ account: 'production', amountMinor: 0, catalog: CATALOG })
        ).toEqual({ ok: false, refusal: 'AMOUNT_DIFFERS', expectedMinor: 150000 });
    });
});
