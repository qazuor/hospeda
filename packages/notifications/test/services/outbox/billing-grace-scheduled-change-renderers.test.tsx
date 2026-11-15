import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingGraceReminderRenderers } from '../../../src/services/outbox/billing-grace-reminder-renderers.js';
import { createBillingSignupRenderers } from '../../../src/services/outbox/billing-signup-renderers.js';
import { row } from './outbox-batch.harness.js';

const started = createBillingSignupRenderers({ siteUrl: 'https://hospeda.test' })[
    'billing.grace-started'
]!;
const reminder = createBillingGraceReminderRenderers({ siteUrl: 'https://hospeda.test' })[
    'billing.grace-reminder'
]!;
const startedPayload = {
    subscriptionId: 'private-id',
    vertical: 'venue',
    graceEndsAt: '2026-10-20T02:00:00.000Z'
};
const reminderPayload = {
    ...startedPayload,
    daysBefore: 3,
    deadlinesVersion: 1,
    paymentMethod: 'CARD'
};
const scheduledChange = {
    planName: 'Alojamiento Pro',
    effectiveAt: '2026-11-01T15:00:00.000Z'
};
const scheduledLine =
    'Tu cambio al plan Alojamiento Pro, programado para el 1 de noviembre de 2026, sigue en pie.';
const pendingLine = 'Tu cambio de plan sigue pendiente.';
const renderStarted = (payload: Record<string, unknown>) =>
    renderToStaticMarkup(
        started({ row: row({ template: 'billing.grace-started', payload }) }).react
    );
const renderReminder = (payload: Record<string, unknown>) =>
    renderToStaticMarkup(
        reminder({ row: row({ template: 'billing.grace-reminder', payload }) }).react
    );

describe('HOS-1784 grace notices mention the scheduled plan change', () => {
    it('grace-started names the destination plan and its date when a change is scheduled', () => {
        // Arrange
        const payload = { ...startedPayload, scheduledChange };

        // Act
        const render = renderStarted(payload);

        // Assert
        expect(render).toContain(scheduledLine);
    });

    it('grace-reminder names the destination plan and its date when a change is scheduled', () => {
        // Arrange
        const payload = { ...reminderPayload, scheduledChange };

        // Act
        const render = renderReminder(payload);

        // Assert
        expect(render).toContain(scheduledLine);
    });

    it('grace-started is byte-identical without a scheduled change', () => {
        // Arrange
        const baseline = renderStarted(startedPayload);
        const explicitFalse = renderStarted({ ...startedPayload, planChangePending: false });

        // Act
        const index = baseline.indexOf('programado para el');

        // Assert
        expect(baseline).toBe(explicitFalse);
        expect(index).toBe(-1);
    });

    it('grace-reminder is byte-identical without a scheduled change', () => {
        // Arrange
        const baseline = renderReminder(reminderPayload);
        const explicitFalse = renderReminder({ ...reminderPayload, planChangePending: false });

        // Act
        const index = baseline.indexOf('programado para el');

        // Assert
        expect(baseline).toBe(explicitFalse);
        expect(index).toBe(-1);
    });

    it('both renderers reject a malformed scheduled change', () => {
        // Arrange
        const malformedChanges: unknown[] = [
            { planName: '', effectiveAt: '2026-11-01T15:00:00.000Z' },
            { planName: 'X', effectiveAt: 'mañana' },
            null,
            []
        ];

        // Act
        const results = malformedChanges.map((malformed) => ({
            started: () => renderStarted({ ...startedPayload, scheduledChange: malformed }),
            reminder: () => renderReminder({ ...reminderPayload, scheduledChange: malformed })
        }));

        // Assert
        for (const result of results) {
            expect(result.started).toThrow(TypeError);
            expect(result.reminder).toThrow(TypeError);
        }
    });

    it('the scheduled change line and the pending successor line can coexist', () => {
        // Arrange
        const payload = { ...startedPayload, planChangePending: true, scheduledChange };

        // Act
        const render = renderStarted(payload);

        // Assert
        expect(render).toContain(scheduledLine);
        expect(render).toContain(pendingLine);
        expect(render.indexOf(scheduledLine)).toBeLessThan(render.indexOf(pendingLine));
    });
});
