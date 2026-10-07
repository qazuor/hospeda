/**
 * TEST:U2:7 (unit half) — the suppression hierarchy of NUCLEO/07 §4.2,
 * evaluated in order and by class (AC:U2:7). The DB half, which proves the
 * facts the sender reads, lives in
 * `packages/db/test/integration/email-outbox-delivery.integration.test.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
    classifyOutboxTemplate,
    evaluateOutboxSuppression,
    OUTBOX_TEMPLATE_CLASS,
    type OutboxSuppressionFacts
} from '../../../src/services/outbox/email-outbox-suppression';
import { NotificationType } from '../../../src/types/notification.types';

const ENQUEUED_AT = new Date('2026-10-07T12:00:00.000Z');

function facts(overrides: Partial<OutboxSuppressionFacts> = {}): OutboxSuppressionFacts {
    return {
        emailClass: 'transactional',
        hasHardBounce: false,
        accountDeletedAt: null,
        enqueuedAt: ENQUEUED_AT,
        optedOut: false,
        commercialSentInWindow: 0,
        dailyCap: 1,
        ...overrides
    };
}

describe('classifyOutboxTemplate', () => {
    it('classifies the five post-trial win-back templates as commercial', () => {
        // Arrange
        const winBacks = [
            NotificationType.TRIAL_WIN_BACK_1D,
            NotificationType.TRIAL_WIN_BACK_5D,
            NotificationType.TRIAL_WIN_BACK_10D,
            NotificationType.TRIAL_WIN_BACK_30D,
            NotificationType.TRIAL_WIN_BACK_60D
        ];

        // Act
        const classes = winBacks.map((template) => classifyOutboxTemplate({ template }).emailClass);

        // Assert
        expect(classes).toEqual(winBacks.map(() => 'commercial'));
        expect(Object.keys(OUTBOX_TEMPLATE_CLASS)).toHaveLength(5);
    });

    it('defaults an unknown template to transactional', () => {
        expect(classifyOutboxTemplate({ template: 'not-a-registered-template' }).emailClass).toBe(
            'transactional'
        );
    });

    it('does not treat inherited object keys as mapped templates', () => {
        expect(classifyOutboxTemplate({ template: 'toString' }).emailClass).toBe('transactional');
    });
});

describe('TEST:U2:7 evaluateOutboxSuppression — the hierarchy in order and by class', () => {
    it('sends a clean transactional mail', () => {
        expect(evaluateOutboxSuppression(facts())).toEqual({ suppressed: false });
    });

    it('sends a clean commercial mail under the cap', () => {
        expect(evaluateOutboxSuppression(facts({ emailClass: 'commercial' }))).toEqual({
            suppressed: false
        });
    });

    describe('(1) hard bounce suppresses everything', () => {
        it('suppresses a TRANSACTIONAL mail and escalates it', () => {
            expect(evaluateOutboxSuppression(facts({ hasHardBounce: true }))).toEqual({
                suppressed: true,
                cause: 'hard_bounce',
                escalate: true
            });
        });

        it('suppresses a commercial mail without escalating', () => {
            expect(
                evaluateOutboxSuppression(facts({ emailClass: 'commercial', hasHardBounce: true }))
            ).toEqual({ suppressed: true, cause: 'hard_bounce', escalate: false });
        });

        it('wins over every later cause', () => {
            // Arrange: every cause applies at once
            const all = facts({
                emailClass: 'commercial',
                hasHardBounce: true,
                accountDeletedAt: new Date(ENQUEUED_AT.getTime() - 1000),
                optedOut: true,
                commercialSentInWindow: 9
            });

            // Act / Assert
            expect(evaluateOutboxSuppression(all)).toMatchObject({ cause: 'hard_bounce' });
        });
    });

    describe('(2) deleted account suppresses what was enqueued AFTER the deletion', () => {
        it('suppresses a transactional mail enqueued after the deletion, without escalating', () => {
            expect(
                evaluateOutboxSuppression(
                    facts({ accountDeletedAt: new Date(ENQUEUED_AT.getTime() - 1) })
                )
            ).toEqual({ suppressed: true, cause: 'account_deleted', escalate: false });
        });

        it('sends a mail enqueued BEFORE the deletion (to the address its row captured)', () => {
            expect(
                evaluateOutboxSuppression(
                    facts({ accountDeletedAt: new Date(ENQUEUED_AT.getTime() + 1) })
                )
            ).toEqual({ suppressed: false });
        });

        it('sends a mail enqueued at the exact instant of the deletion', () => {
            expect(evaluateOutboxSuppression(facts({ accountDeletedAt: ENQUEUED_AT }))).toEqual({
                suppressed: false
            });
        });

        it('wins over opt-out and cap', () => {
            expect(
                evaluateOutboxSuppression(
                    facts({
                        emailClass: 'commercial',
                        accountDeletedAt: new Date(ENQUEUED_AT.getTime() - 1),
                        optedOut: true,
                        commercialSentInWindow: 5
                    })
                )
            ).toMatchObject({ cause: 'account_deleted' });
        });
    });

    describe('(3) opt-out suppresses commercial mail only', () => {
        it('suppresses an opted-out commercial mail', () => {
            expect(
                evaluateOutboxSuppression(facts({ emailClass: 'commercial', optedOut: true }))
            ).toEqual({ suppressed: true, cause: 'opt_out', escalate: false });
        });

        it('never suppresses a transactional mail', () => {
            expect(evaluateOutboxSuppression(facts({ optedOut: true }))).toEqual({
                suppressed: false
            });
        });

        it('wins over the cap', () => {
            expect(
                evaluateOutboxSuppression(
                    facts({ emailClass: 'commercial', optedOut: true, commercialSentInWindow: 3 })
                )
            ).toMatchObject({ cause: 'opt_out' });
        });
    });

    describe('(4) daily cap suppresses commercial mail only', () => {
        it('suppresses a commercial mail once the recipient reached the cap', () => {
            expect(
                evaluateOutboxSuppression(
                    facts({ emailClass: 'commercial', commercialSentInWindow: 1 })
                )
            ).toEqual({ suppressed: true, cause: 'daily_cap', escalate: false });
        });

        it('sends a commercial mail just under a larger cap', () => {
            expect(
                evaluateOutboxSuppression(
                    facts({ emailClass: 'commercial', commercialSentInWindow: 2, dailyCap: 3 })
                )
            ).toEqual({ suppressed: false });
        });

        it('never caps a transactional mail', () => {
            expect(evaluateOutboxSuppression(facts({ commercialSentInWindow: 50 }))).toEqual({
                suppressed: false
            });
        });
    });
});
