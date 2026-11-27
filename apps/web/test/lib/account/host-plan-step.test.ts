/**
 * @file host-plan-step.test.ts
 * @description The Plan card's paid-plan next step (HOS-2664): days to the end of
 * a scheduled cancellation or grace period, else days to the next charge.
 */

import { describe, expect, it } from 'vitest';
import { resolveHostPlanDateStep } from '../../../src/lib/account/host-plan-step';

const NOW = Date.parse('2026-11-27T12:00:00.000Z');
const inDays = (days: number) => new Date(NOW + days * 86_400_000 - 1000).toISOString();
const row = (over: Record<string, unknown>) =>
    ({
        vertical: 'accommodation',
        status: 'ACTIVE',
        serviceEndsAt: null,
        graceEndsAt: null,
        nextCharge: null,
        ...over
    }) as never;

describe('resolveHostPlanDateStep', () => {
    it('says when a scheduled cancellation ends', () => {
        const rows = [row({ status: 'CANCEL_SCHEDULED', serviceEndsAt: inDays(5) })];
        expect(resolveHostPlanDateStep({ rows, locale: 'es', now: NOW })).toBe(
            'Tu suscripción vence en 5 días.'
        );
    });

    it('says when the next charge happens for an active plan', () => {
        const rows = [row({ nextCharge: { at: inDays(1), amount: 1, currency: 'ARS' } })];
        expect(resolveHostPlanDateStep({ rows, locale: 'en', now: NOW })).toBe(
            'Your next charge is in 1 day.'
        );
    });

    it('prefers the accommodation subscription over other verticals', () => {
        const rows = [
            row({ vertical: 'venue', status: 'GRACE_PERIOD', graceEndsAt: inDays(2) }),
            row({ status: 'GRACE_PERIOD', graceEndsAt: inDays(9) })
        ];
        expect(resolveHostPlanDateStep({ rows, locale: 'es', now: NOW })).toContain('9 días');
    });

    it('returns null without a usable future date', () => {
        const rows = [row({ status: 'CANCEL_SCHEDULED', serviceEndsAt: inDays(-3) })];
        expect(resolveHostPlanDateStep({ rows, locale: 'es', now: NOW })).toBeNull();
        expect(resolveHostPlanDateStep({ rows: [], locale: 'es', now: NOW })).toBeNull();
    });
});
