import { describe, expect, it } from 'vitest';
import {
    ADDON_LINE_KEY,
    CANCELLATION_OFFERED,
    END_LINE_KEY,
    formatSelfCancelDate,
    GRACE_NOTICE,
    parseCancellationPreview,
    parseOwnSubscriptions
} from '@/lib/billing/self-cancel';

describe('self-cancel helpers', () => {
    it('maps all supported states and addon effects', () => {
        expect(CANCELLATION_OFFERED).toEqual({
            ACTIVE: true,
            GRACE_PERIOD: true,
            SUSPENDED: true,
            CANCEL_SCHEDULED: false
        });
        expect(END_LINE_KEY).toEqual({
            ACTIVE: 'account.subscription.cancel.activeEnds',
            GRACE_PERIOD: 'account.subscription.cancel.graceEnds',
            SUSPENDED: 'account.subscription.cancel.suspendedEnds'
        });
        expect(ADDON_LINE_KEY).toEqual({
            CHARGE_CUT_TODAY: 'account.subscription.cancel.addon.CHARGE_CUT_TODAY',
            AT_SERVICE_END: 'account.subscription.cancel.addon.AT_SERVICE_END',
            TODAY: 'account.subscription.cancel.addon.TODAY'
        });
        expect(GRACE_NOTICE).toEqual({ CARD: true, MANUAL: false });
    });
    it('parses valid reads and fails closed for errors or malformed bodies', () => {
        const valid = { ok: true, data: { subscriptions: [] } };
        const validPreview = {
            ok: true,
            data: {
                subscriptionId: '123e4567-e89b-42d3-a456-426614174000',
                vertical: 'accommodation',
                paymentMethod: 'CARD',
                origin: 'ACTIVE',
                serviceEndsAt: '2026-11-05T03:00:00.000Z',
                addons: []
            }
        };
        expect(parseOwnSubscriptions({ result: valid })).toEqual(valid.data);
        expect(parseCancellationPreview({ result: validPreview })).toEqual(validPreview.data);
        expect(parseOwnSubscriptions({ result: { ok: false } })).toBeNull();
        expect(parseOwnSubscriptions({ result: { ok: true, data: {} } })).toBeNull();
        expect(parseCancellationPreview({ result: { ok: false } })).toBeNull();
        expect(parseCancellationPreview({ result: { ok: true, data: {} } })).toBeNull();
    });
    it('uses the Buenos Aires market date for instants', () => {
        expect(formatSelfCancelDate({ iso: '2026-04-02T02:00:00.000Z', locale: 'es' })).toContain(
            '1 de abril de 2026'
        );
    });
});
