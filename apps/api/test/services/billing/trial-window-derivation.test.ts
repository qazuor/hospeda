/**
 * Regression tests for HOS-936 — "el trial local se deriva de `free_trial`, que
 * miente".
 *
 * The measured case is reproduced verbatim in the first describe block: two
 * preapprovals for the SAME payer on the SAME plan, created two seconds apart on
 * 2026-08-31, whose `free_trial` and `first_invoice_offset` are byte-identical
 * and whose `next_payment_date` is not. Only the second one is being charged
 * immediately, and only `next_payment_date` says so.
 *
 * The tests are written against the RAW payloads — `free_trial` and
 * `first_invoice_offset` included — precisely so that a future implementation
 * which starts reading them again fails here: on this data, believing
 * `free_trial` yields a 30-day trial for BOTH subscriptions.
 */
import { describe, expect, it } from 'vitest';
import {
    deriveTrialWindowFromPreapproval,
    readTrialWindowFromPreapprovalPayload
} from '../../../src/services/billing/trial-window-derivation.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * The trial terms BOTH preapprovals reported. Identical objects — this is the
 * whole point of the finding, and the reason no test here may assert on them
 * except to prove they cannot discriminate.
 */
const IDENTICAL_TRIAL_TERMS = {
    free_trial: { frequency: 30, frequency_type: 'days' },
    first_invoice_offset: 30
} as const;

/**
 * 1st preapproval `33e50721` — MercadoPago deferred the charge by 30 days.
 *
 * The finding records `next_payment_date` as `2026-09-29`, which is the same
 * instant in Argentina's `-04:00` offset: `2026-08-30T23:28:02-04:00` plus 30
 * days is `2026-09-29T23:28:02-04:00`, i.e. `2026-09-30T03:28:02Z`. Written in
 * UTC here so the arithmetic in the assertions is exact.
 */
const FIRST_PREAPPROVAL = {
    id: '33e50721',
    date_created: '2026-08-31T03:28:02.000Z',
    next_payment_date: '2026-09-30T03:28:02.000Z',
    auto_recurring: { ...IDENTICAL_TRIAL_TERMS }
} as const;

/**
 * 2nd preapproval `54889b0a` — same payer, same plan, two seconds later.
 * `next_payment_date` IS `date_created`: MercadoPago is charging now.
 */
const SECOND_PREAPPROVAL = {
    id: '54889b0a',
    date_created: '2026-08-31T03:28:04.000Z',
    next_payment_date: '2026-08-31T03:28:04.000Z',
    auto_recurring: { ...IDENTICAL_TRIAL_TERMS }
} as const;

describe('HOS-936 regression — two preapprovals, same payer, same plan', () => {
    it('grants a trial for the 1st preapproval, whose charge is 30 days out', () => {
        // Arrange / Act
        const result = readTrialWindowFromPreapprovalPayload(FIRST_PREAPPROVAL);

        // Assert
        expect(result.outcome).toBe('granted');
        expect(result.trialEnd?.toISOString()).toBe('2026-09-30T03:28:02.000Z');
        expect(result.deferralMs).toBe(30 * DAY_MS);
    });

    it('writes NO trial for the 2nd preapproval, created two seconds later', () => {
        // Arrange / Act — the identical `free_trial` above says 30 days. The
        // dates say the charge lands at the creation instant.
        const result = readTrialWindowFromPreapprovalPayload(SECOND_PREAPPROVAL);

        // Assert — this is the assertion that fails if anyone reads
        // `free_trial` or `first_invoice_offset` again.
        expect(result.outcome).toBe('not-granted');
        expect(result.trialEnd).toBeNull();
        expect(result.deferralMs).toBe(0);
    });

    it('reaches OPPOSITE verdicts from payloads whose trial terms are identical', () => {
        // Arrange — prove the premise the whole issue rests on, rather than
        // asserting it in prose: the two payloads agree on every trial field
        // MercadoPago advertises, and disagree only on `next_payment_date`.
        expect(FIRST_PREAPPROVAL.auto_recurring).toEqual(SECOND_PREAPPROVAL.auto_recurring);

        // Act
        const first = readTrialWindowFromPreapprovalPayload(FIRST_PREAPPROVAL);
        const second = readTrialWindowFromPreapprovalPayload(SECOND_PREAPPROVAL);

        // Assert — any derivation keyed on the advertised terms returns the SAME
        // answer for both. Only `next_payment_date` separates them.
        expect(first.outcome).not.toBe(second.outcome);
    });
});

describe('deriveTrialWindowFromPreapproval — the threshold', () => {
    const created = new Date('2026-08-31T03:28:02.000Z');

    it('treats a same-instant first charge as no trial', () => {
        const result = deriveTrialWindowFromPreapproval({
            dateCreated: created,
            nextPaymentDate: created
        });

        expect(result.outcome).toBe('not-granted');
        expect(result.deferralMs).toBe(0);
    });

    it('treats a charge deferred by seconds as no trial (authorization lag, not a trial)', () => {
        const result = deriveTrialWindowFromPreapproval({
            dateCreated: created,
            nextPaymentDate: new Date(created.getTime() + 90_000)
        });

        expect(result.outcome).toBe('not-granted');
    });

    it('treats a charge deferred by just under an hour as no trial', () => {
        const result = deriveTrialWindowFromPreapproval({
            dateCreated: created,
            nextPaymentDate: new Date(created.getTime() + HOUR_MS - 1)
        });

        expect(result.outcome).toBe('not-granted');
    });

    it('treats a charge deferred by exactly an hour as a granted trial', () => {
        const result = deriveTrialWindowFromPreapproval({
            dateCreated: created,
            nextPaymentDate: new Date(created.getTime() + HOUR_MS)
        });

        expect(result.outcome).toBe('granted');
        expect(result.deferralMs).toBe(HOUR_MS);
    });

    it('honours the shortest trial MercadoPago can express (one day)', () => {
        // `free_trial.frequency_type` is `days`, so a one-day plan is the floor.
        // The threshold must never swallow it.
        const result = deriveTrialWindowFromPreapproval({
            dateCreated: created,
            nextPaymentDate: new Date(created.getTime() + DAY_MS)
        });

        expect(result.outcome).toBe('granted');
        expect(result.trialEnd?.getTime()).toBe(created.getTime() + DAY_MS);
    });
});

describe('deriveTrialWindowFromPreapproval — refuses to guess', () => {
    const created = new Date('2026-08-31T03:28:02.000Z');

    it('returns `unknown`, not `not-granted`, when `next_payment_date` is absent', () => {
        // A missing date must never strip a trial the provider may be honouring.
        const result = deriveTrialWindowFromPreapproval({
            dateCreated: created,
            nextPaymentDate: null
        });

        expect(result.outcome).toBe('unknown');
        expect(result.trialEnd).toBeNull();
        expect(result.deferralMs).toBeNull();
    });

    it('returns `unknown` when `date_created` is absent', () => {
        const result = deriveTrialWindowFromPreapproval({
            dateCreated: undefined,
            nextPaymentDate: new Date(created.getTime() + 30 * DAY_MS)
        });

        expect(result.outcome).toBe('unknown');
    });

    it('returns `unknown` for an unparseable timestamp', () => {
        const result = deriveTrialWindowFromPreapproval({
            dateCreated: new Date('not-a-date'),
            nextPaymentDate: new Date(created.getTime() + 30 * DAY_MS)
        });

        expect(result.outcome).toBe('unknown');
    });

    it('returns `unknown` for a first charge dated BEFORE creation', () => {
        // Not a zero-length trial — a response we do not understand.
        const result = deriveTrialWindowFromPreapproval({
            dateCreated: created,
            nextPaymentDate: new Date(created.getTime() - DAY_MS)
        });

        expect(result.outcome).toBe('unknown');
        expect(result.deferralMs).toBe(-DAY_MS);
    });
});

describe('readTrialWindowFromPreapprovalPayload — shapes it must survive', () => {
    it('returns `unknown` for qzpay’s mapped shape, which carries neither field', () => {
        // `mapToProviderSubscription` builds a closed camelCase object with no
        // `date_created`/`next_payment_date` at all. It must yield `unknown` —
        // NOT a fabricated verdict in either direction.
        const mapped = {
            id: 'mp-1',
            status: 'authorized',
            currentPeriodStart: new Date('2026-08-31T03:28:02.000Z'),
            currentPeriodEnd: new Date('2026-09-30T03:28:02.000Z'),
            trialStart: null,
            trialEnd: null
        };

        expect(readTrialWindowFromPreapprovalPayload(mapped).outcome).toBe('unknown');
    });

    it('reads a camelCased payload as well as the raw snake_case one', () => {
        const result = readTrialWindowFromPreapprovalPayload({
            dateCreated: '2026-08-31T03:28:02.000Z',
            nextPaymentDate: '2026-09-30T03:28:02.000Z'
        });

        expect(result.outcome).toBe('granted');
        expect(result.deferralMs).toBe(30 * DAY_MS);
    });

    it('accepts real Date instances, not only ISO strings', () => {
        const result = readTrialWindowFromPreapprovalPayload({
            date_created: new Date('2026-08-31T03:28:02.000Z'),
            next_payment_date: new Date('2026-09-30T03:28:02.000Z')
        });

        expect(result.outcome).toBe('granted');
    });

    it('returns `unknown` for every non-object payload', () => {
        for (const value of [null, undefined, 'preapproval', 42]) {
            expect(readTrialWindowFromPreapprovalPayload(value).outcome).toBe('unknown');
        }
    });

    it('returns `unknown` when the honest fields are present but unusable', () => {
        const result = readTrialWindowFromPreapprovalPayload({
            date_created: '',
            next_payment_date: 'tomorrow',
            auto_recurring: { ...IDENTICAL_TRIAL_TERMS }
        });

        expect(result.outcome).toBe('unknown');
    });
});
