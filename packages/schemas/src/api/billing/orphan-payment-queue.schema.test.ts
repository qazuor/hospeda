/**
 * HOS-1001 — orphan-payment queue schema contract.
 *
 * Three claims, each of which fails SILENTLY in a way that misleads an operator
 * rather than erroring:
 *
 * 1. `?livemode=false` means SANDBOX. A query parameter arrives as a string and
 *    `Boolean('false')` is `true`, so the obvious `z.coerce.boolean()` answers
 *    "show me the sandbox rows" with production charges. On this endpoint that
 *    is the difference between a test charge and real money.
 * 2. The default status is `unresolved`. "No filters" must mean "the
 *    outstanding work", never "every row ever queued" — one live incident
 *    buried under a year of settled ones is the same as no incident.
 * 3. The vocabularies are CLOSED. The columns are free `varchar`; these enums
 *    are the only thing that keeps the writer and the reader agreeing.
 *
 * @module api/billing/orphan-payment-queue.schema.test
 */

import { describe, expect, it } from 'vitest';
import {
    OrphanPaymentFlowSchema,
    OrphanPaymentQueueSearchSchema,
    OrphanPaymentReasonSchema,
    ResolveOrphanPaymentRequestSchema
} from './orphan-payment-queue.schema.js';

describe('OrphanPaymentQueueSearchSchema — livemode is read as a string, not coerced', () => {
    it('reads "false" as sandbox, not as truthy', () => {
        const parsed = OrphanPaymentQueueSearchSchema.parse({ livemode: 'false' });

        expect(parsed.livemode).toBe(false);
    });

    it('reads "true" as real money', () => {
        const parsed = OrphanPaymentQueueSearchSchema.parse({ livemode: 'true' });

        expect(parsed.livemode).toBe(true);
    });

    it('leaves livemode undefined when the caller did not ask', () => {
        // Undefined must mean BOTH, not "false" — a defaulted filter would hide
        // half the queue from anyone who never touched the control.
        const parsed = OrphanPaymentQueueSearchSchema.parse({});

        expect(parsed.livemode).toBeUndefined();
    });

    it('rejects a livemode that is neither', () => {
        expect(() => OrphanPaymentQueueSearchSchema.parse({ livemode: 'yes' })).toThrow();
    });
});

describe('OrphanPaymentQueueSearchSchema — defaults', () => {
    it('defaults status to unresolved', () => {
        const parsed = OrphanPaymentQueueSearchSchema.parse({});

        expect(parsed.status).toBe('unresolved');
    });

    it('defaults to page 1 and coerces the string a query string carries', () => {
        expect(OrphanPaymentQueueSearchSchema.parse({}).page).toBe(1);
        expect(OrphanPaymentQueueSearchSchema.parse({ page: '3' }).page).toBe(3);
    });

    it('caps pageSize so one request cannot pull the whole table', () => {
        expect(() => OrphanPaymentQueueSearchSchema.parse({ pageSize: '500' })).toThrow();
    });
});

describe('the queue vocabularies are closed', () => {
    it('accepts exactly the four flows and nothing else', () => {
        expect(OrphanPaymentFlowSchema.options).toEqual([
            'plan-change-upgrade',
            'annual-upfront',
            'addon-purchase',
            'subscription-authorized-payment-retry'
        ]);
        expect(() => OrphanPaymentFlowSchema.parse('something-else')).toThrow();
    });

    it('accepts exactly the three reasons and nothing else', () => {
        expect(OrphanPaymentReasonSchema.options).toEqual([
            'subscription-not-found',
            'subscription-status-not-applicable',
            'ledger-write-failed'
        ]);
        expect(() => OrphanPaymentReasonSchema.parse('something-else')).toThrow();
    });
});

describe('ResolveOrphanPaymentRequestSchema', () => {
    const VALID = {
        orphanPaymentId: '11111111-1111-4111-8111-111111111111',
        resolution: 'resolved',
        note: 'Backfilled through the rescue tool.'
    };

    it('accepts a well-formed verdict', () => {
        expect(() => ResolveOrphanPaymentRequestSchema.parse(VALID)).not.toThrow();
    });

    it('refuses a note too short to explain anything', () => {
        // The note is the only thing that tells a future reader whether the
        // customer was made whole; "ok" is not that.
        expect(() => ResolveOrphanPaymentRequestSchema.parse({ ...VALID, note: 'ok' })).toThrow();
    });

    it('refuses a note that is only whitespace', () => {
        expect(() =>
            ResolveOrphanPaymentRequestSchema.parse({ ...VALID, note: '              ' })
        ).toThrow();
    });

    it('refuses reopening a row', () => {
        // `unresolved` is deliberately NOT a resolution: reopening a triaged
        // payment is a decision with consequences of its own.
        expect(() =>
            ResolveOrphanPaymentRequestSchema.parse({ ...VALID, resolution: 'unresolved' })
        ).toThrow();
    });
});
