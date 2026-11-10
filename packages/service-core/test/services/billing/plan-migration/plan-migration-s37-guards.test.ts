import { describe, expect, it } from 'vitest';
import { evaluateS37Guards } from '../../../../src/services/billing/plan-migration/plan-migration-s37-guards.js';

const applicationDate = new Date('2026-12-11T12:00:00.000Z');
const atSevenDays = new Date('2026-12-04T12:00:00.000Z');

function baseInput(overrides: Record<string, unknown> = {}) {
    return {
        reason: 'RETIREMENT',
        migrationCancelled: false,
        scopeStatus: 'PENDIENTE',
        subscription: {
            class: 'PRINCIPAL',
            status: 'ACTIVE',
            succeedsId: null,
            succeededById: null
        },
        hasQueuedChange: false,
        targetOffersCycle: true,
        applicationDate,
        today: atSevenDays,
        ...overrides
    } as Parameters<typeof evaluateS37Guards>[0];
}

describe('S37 guards', () => {
    it('proceeds seven local days before the application date', () => {
        expect(evaluateS37Guards(baseInput())).toEqual({ verdict: 'PROCEED' });
    });

    it('skips a cancelled migration', () => {
        expect(evaluateS37Guards(baseInput({ migrationCancelled: true }))).toEqual({
            verdict: 'SKIPPED',
            reason: 'MIGRATION_CANCELLED'
        });
    });

    it('skips any motive other than retirement', () => {
        expect(evaluateS37Guards(baseInput({ reason: 'PRICE_INCREASE' }))).toEqual({
            verdict: 'SKIPPED',
            reason: 'REASON_NOT_RETIREMENT'
        });
    });

    it('skips a participation row that is no longer pending', () => {
        expect(evaluateS37Guards(baseInput({ scopeStatus: 'FUERA' }))).toEqual({
            verdict: 'SKIPPED',
            reason: 'SCOPE_NOT_PENDING'
        });
    });

    it('skips a row that is not principal', () => {
        expect(
            evaluateS37Guards(
                baseInput({
                    subscription: {
                        class: 'COMPLEMENTO',
                        status: 'ACTIVE',
                        succeedsId: null,
                        succeededById: null
                    }
                })
            )
        ).toEqual({ verdict: 'SKIPPED', reason: 'NOT_PRINCIPAL' });
    });

    it('waits on any state other than active', () => {
        expect(
            evaluateS37Guards(
                baseInput({
                    subscription: {
                        class: 'PRINCIPAL',
                        status: 'PAUSED',
                        succeedsId: null,
                        succeededById: null
                    }
                })
            )
        ).toEqual({ verdict: 'WAITING', reason: 'SUBSCRIPTION_NOT_ACTIVE' });
    });

    it('waits while a succession is in progress', () => {
        expect(
            evaluateS37Guards(
                baseInput({
                    subscription: {
                        class: 'PRINCIPAL',
                        status: 'ACTIVE',
                        succeedsId: crypto.randomUUID(),
                        succeededById: null
                    }
                })
            )
        ).toEqual({ verdict: 'WAITING', reason: 'SUCCESSION_IN_PROGRESS' });
    });

    it('skips when a change is already queued', () => {
        expect(evaluateS37Guards(baseInput({ hasQueuedChange: true }))).toEqual({
            verdict: 'SKIPPED',
            reason: 'QUEUED_CHANGE_EXISTS'
        });
    });

    it('skips when the destination does not offer the cycle', () => {
        expect(evaluateS37Guards(baseInput({ targetOffersCycle: false }))).toEqual({
            verdict: 'SKIPPED',
            reason: 'DESTINATION_CYCLE_MISSING'
        });
    });

    it('is not due eight local days before', () => {
        expect(
            evaluateS37Guards(baseInput({ today: new Date('2026-12-03T12:00:00.000Z') }))
        ).toEqual({ verdict: 'NOT_DUE', reason: 'NOT_YET_DUE' });
    });

    it('proceeds late in the local day seven days before', () => {
        // 2026-12-05T02:30Z is 2026-12-04 23:30 in Buenos Aires.
        expect(
            evaluateS37Guards(baseInput({ today: new Date('2026-12-05T02:30:00.000Z') }))
        ).toEqual({ verdict: 'PROCEED' });
    });

    it('proceeds the local day before the application date', () => {
        expect(
            evaluateS37Guards(baseInput({ today: new Date('2026-12-10T12:00:00.000Z') }))
        ).toEqual({ verdict: 'PROCEED' });
    });

    it('is not due on the application date', () => {
        expect(
            evaluateS37Guards(baseInput({ today: new Date('2026-12-11T12:00:00.000Z') }))
        ).toEqual({ verdict: 'NOT_DUE', reason: 'APPLICATION_DATE_REACHED' });
    });
});
