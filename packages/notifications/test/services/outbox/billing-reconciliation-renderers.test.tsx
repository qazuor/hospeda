import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createBillingReconciliationRenderers } from '../../../src/services/outbox/billing-reconciliation-renderers.js';
import { classifyOutboxTemplate } from '../../../src/services/outbox/email-outbox-suppression.js';
import {
    DUPLICATE_CHARGE_DETECTED_SUBJECT,
    MARK_ESCALATED_SUBJECT,
    RECONCILIATION_SUMMARY_SUBJECT,
    REVOCATION_REFUND_FAILED_SUBJECT,
    type ReconciliationSubjectsReader
} from '../../../src/templates/billing/index.js';
import { row } from './outbox-batch.harness.js';

const renderers = createBillingReconciliationRenderers({ siteUrl: 'https://hospeda.test' });
const summary = {
    windowId: 'window-1',
    coversFrom: '2026-10-01T00:00:00.000Z',
    closesAt: '2026-10-02T00:00:00.000Z',
    windowMinutes: 60,
    totals: { events: 100 },
    marks: [
        {
            reason: 'RECONCILIATION_REQUIRED',
            subjectType: 'subscription',
            subjectId: 'sub-1',
            count: 100
        }
    ],
    escalations: [
        {
            reason: 'COBRO_DUPLICADO',
            subjectType: 'addon_instance',
            subjectId: 'addon-1',
            markId: 'mark-1'
        }
    ],
    underCharges: [
        {
            subscriptionId: 'sub-1',
            paymentId: 'pay-1',
            currency: 'ARS',
            expectedMinor: 10000,
            chargedMinor: 5000,
            differenceMinor: 5000
        }
    ],
    pauseGifts: [
        {
            subscriptionId: 'sub-2',
            pauseId: 'pause-1',
            pauseStartedAt: '2026-09-01T00:00:00.000Z',
            pauseEndedAt: '2026-09-10T00:00:00.000Z',
            skippedChargeAt: '2026-09-05T00:00:00.000Z',
            nextChargeAfterReturnAt: '2026-10-05T00:00:00.000Z',
            giftDays: 5
        }
    ],
    omitted: { marks: 2, escalations: 0, underCharges: 0, pauseGifts: 0 }
};

describe('TEST:1607:8 reconciliation summary renderer', () => {
    it('renders all populated sections, count, omission line, and no action 16', async () => {
        const result = await renderers['billing.reconciliation-summary']!({
            row: row({ template: 'billing.reconciliation-summary', payload: summary })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(RECONCILIATION_SUMMARY_SUBJECT);
        expect(html).toContain('RECONCILIATION_REQUIRED');
        expect(html).toContain('100 veces');
        expect(html).not.toContain(' · ');
        expect(html).toContain('Marcas que pasaron su plazo sin resolverse');
        expect(html).toContain('Cobros por debajo del esperado');
        expect(html).toContain('Pausas que regalaron días');
        expect(html).toContain('… y 2 más');
        expect(html).not.toContain('acción 16');
        expect(html).not.toContain('actos administrativos');
        const empty = await renderers['billing.reconciliation-summary']!({
            row: row({
                template: 'billing.reconciliation-summary',
                payload: { ...summary, marks: [], omitted: { ...summary.omitted, marks: 0 } }
            })
        });
        expect(renderToStaticMarkup(empty.react)).not.toContain('Marcas abiertas');
    });

    it.each([
        ['missing windowId', { ...summary, windowId: undefined }],
        ['marks not array', { ...summary, marks: {} }],
        ['zero window', { ...summary, windowMinutes: 0 }],
        ['non-ISO date', { ...summary, coversFrom: 'yesterday' }],
        [
            'unknown subject',
            { ...summary, marks: [{ ...summary.marks[0], subjectType: 'unknown' }] }
        ]
    ])('rejects invalid summary: %s', (_label, payload) => {
        expect(() =>
            renderers['billing.reconciliation-summary']!({
                row: row({ template: 'billing.reconciliation-summary', payload })
            })
        ).toThrow(TypeError);
    });
});

describe('TEST:1607:9 immediate transactional renderers', () => {
    it('renders revocation refund failure and rejects invalid payload fields', async () => {
        const payload = {
            refundId: 'refund-1',
            refundReason: 'REVOCATION',
            sourceKind: 'payment',
            sourceId: 'payment-1',
            subjectType: null,
            subjectId: null,
            amountMinor: 250000,
            currency: 'ARS',
            failedAt: '2026-10-01T00:00:00.000Z'
        };
        const result = await renderers['billing.revocation-refund-failed']!({
            row: row({ template: 'billing.revocation-refund-failed', payload })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(REVOCATION_REFUND_FAILED_SUBJECT);
        expect(html).toContain('refund-1');
        expect(html).toContain('payment-1');
        expect(html).toContain('$2.500,00');
        expect(html).toContain('Revocación');
        expect(html).toContain('Pago con Mercado Pago');
        expect(html).not.toContain('Sujeto');
        expect(html).not.toContain('REVOCATION');
        for (const invalid of [
            { ...payload, refundReason: 'MARK_PROPOSAL' },
            { ...payload, amountMinor: 0 },
            { ...payload, failedAt: 'yesterday' },
            { ...payload, subjectType: 'subscription' }
        ]) {
            expect(() =>
                renderers['billing.revocation-refund-failed']!({
                    row: row({ template: 'billing.revocation-refund-failed', payload: invalid })
                })
            ).toThrow(TypeError);
        }
    });
    it('renders duplicate charge details and omits a null payment identifier', async () => {
        const payload = {
            markId: 'mark-1',
            subjectType: 'subscription',
            subjectId: 'sub-1',
            reason: 'COBRO_DUPLICADO',
            openedAt: '2026-10-01T00:00:00.000Z',
            paymentId: 'pay-1'
        };
        const result = await renderers['billing.duplicate-charge-detected']!({
            row: row({ template: 'billing.duplicate-charge-detected', payload })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(DUPLICATE_CHARGE_DETECTED_SUBJECT);
        expect(html).toContain('Suscripción');
        expect(html).toContain('sub-1');
        expect(html).toContain('Cobro duplicado');
        expect(html).not.toContain('COBRO_DUPLICADO');
        expect(html).not.toContain('>subscription');
        expect(html).toContain('pay-1');
        const withoutPayment = await renderers['billing.duplicate-charge-detected']!({
            row: row({
                template: 'billing.duplicate-charge-detected',
                payload: { ...payload, paymentId: null }
            })
        });
        expect(renderToStaticMarkup(withoutPayment.react)).not.toContain('pay-1');
        expect(() =>
            renderers['billing.duplicate-charge-detected']!({
                row: row({ template: 'billing.duplicate-charge-detected', payload: {} })
            })
        ).toThrow(TypeError);
    });

    it('renders escalation details and rejects invalid payloads', async () => {
        const payload = {
            markId: 'mark-2',
            subjectType: 'addon_instance',
            subjectId: 'addon-2',
            reason: 'RECONCILIATION_REQUIRED',
            placedAt: '2026-09-01T00:00:00.000Z',
            escalatedAt: '2026-09-08T00:00:00.000Z',
            escalationDays: 7
        };
        const result = await renderers['billing.mark-escalated']!({
            row: row({ template: 'billing.mark-escalated', payload })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(MARK_ESCALATED_SUBJECT);
        for (const value of [
            'RECONCILIATION_REQUIRED',
            'Complemento',
            'addon-2',
            '7 días',
            '1 de septiembre de 2026',
            '8 de septiembre de 2026'
        ])
            expect(html).toContain(value);
        for (const invalid of [
            { ...payload, escalationDays: 0 },
            { ...payload, subjectType: 'bad' },
            { ...payload, placedAt: 'bad' }
        ]) {
            expect(() =>
                renderers['billing.mark-escalated']!({
                    row: row({ template: 'billing.mark-escalated', payload: invalid })
                })
            ).toThrow(TypeError);
        }
    });

    it('classifies all four templates as transactional by default', () => {
        for (const template of [
            'billing.reconciliation-summary',
            'billing.duplicate-charge-detected',
            'billing.mark-escalated',
            'billing.revocation-refund-failed'
        ]) {
            expect(classifyOutboxTemplate({ template }).emailClass).toBe('transactional');
        }
    });
});

const ADMIN_URL = 'https://admin.hospeda.test';
const MARK_PAYLOAD = {
    markId: 'mark-9',
    subjectType: 'subscription',
    subjectId: 'sub-9',
    reason: 'COBRO_DUPLICADO',
    openedAt: '2026-10-01T00:00:00.000Z',
    paymentId: null
};
const ESCALATION_PAYLOAD = {
    markId: 'mark-9',
    subjectType: 'subscription',
    subjectId: 'sub-9',
    reason: 'COBRO_DUPLICADO',
    placedAt: '2026-09-01T00:00:00.000Z',
    escalatedAt: '2026-09-08T00:00:00.000Z',
    escalationDays: 7
};
const holderReader: ReconciliationSubjectsReader = async ({ subscriptionIds }) => ({
    subscriptions: new Map(
        subscriptionIds.map((id) => [
            id,
            {
                holderName: 'Ana Pérez',
                holderEmail: 'ana@example.com',
                vertical: 'venue',
                planName: 'Pro',
                cycle: 'monthly',
                amountMinor: 1850000,
                currency: 'ARS',
                status: 'ACTIVE',
                listingNames: []
            }
        ])
    ),
    addonInstances: new Map(),
    openMarks: new Map()
});

async function renderNotice(
    template: 'billing.duplicate-charge-detected' | 'billing.mark-escalated',
    payload: Record<string, unknown>,
    input: Partial<Parameters<typeof createBillingReconciliationRenderers>[0]>
): Promise<string> {
    const built = createBillingReconciliationRenderers({
        siteUrl: 'https://hospeda.test',
        ...input
    });
    const result = await built[template]!({ row: row({ template, payload }) });
    return renderToStaticMarkup(result.react);
}

describe('HOS-2565 staff notices: admin link, holder rows and reason label', () => {
    it.each([
        ['billing.duplicate-charge-detected', MARK_PAYLOAD],
        ['billing.mark-escalated', ESCALATION_PAYLOAD]
    ] as const)('%s links the mark events page and shows holder and plan', async (template, payload) => {
        // Act
        const html = await renderNotice(template, payload, {
            adminUrl: `${ADMIN_URL}/`,
            readSubjects: holderReader,
            resolveReasonLabel: () => 'Etiqueta del panel'
        });

        // Assert
        expect(html).toContain(`href="${ADMIN_URL}/billing/reconciliation/mark-9/events"`);
        expect(html).toContain('Ana Pérez &lt;ana@example.com&gt;');
        expect(html).toContain('Comer y salir Pro mensual $18.500,00');
        expect(html).toContain('Etiqueta del panel');
        expect(html).not.toContain('COBRO_DUPLICADO');
    });

    it.each([
        ['billing.duplicate-charge-detected', MARK_PAYLOAD],
        ['billing.mark-escalated', ESCALATION_PAYLOAD]
    ] as const)('%s still renders, without holder and plan, when the reader throws (AC-3.9)', async (template, payload) => {
        // Arrange
        const onEnrichmentError = vi.fn();
        const failing: ReconciliationSubjectsReader = async () => {
            throw new Error('db down');
        };

        // Act
        const html = await renderNotice(template, payload, {
            adminUrl: ADMIN_URL,
            readSubjects: failing,
            onEnrichmentError
        });

        // Assert
        expect(html).toContain('Motivo');
        expect(html).not.toContain('Titular');
        expect(html).not.toContain('Plan</');
        expect(html).toContain(`href="${ADMIN_URL}/billing/reconciliation/mark-9/events"`);
        expect(onEnrichmentError).toHaveBeenCalledTimes(1);
    });

    it('links the refunds page from the failed refund notice, and only with an admin URL', async () => {
        // Arrange
        const payload = {
            refundId: 'refund-1',
            refundReason: 'ADDON_ORPHAN',
            sourceKind: 'manual_payment',
            sourceId: 'payment-1',
            subjectType: 'addon_instance',
            subjectId: 'addon-1',
            amountMinor: 250000,
            currency: null,
            failedAt: '2026-10-01T00:00:00.000Z'
        };
        const render = async (input: { adminUrl?: string }) => {
            const built = createBillingReconciliationRenderers({
                siteUrl: 'https://hospeda.test',
                ...input
            });
            const result = await built['billing.revocation-refund-failed']!({
                row: row({ template: 'billing.revocation-refund-failed', payload })
            });
            return renderToStaticMarkup(result.react);
        };

        // Act
        const withAdmin = await render({ adminUrl: ADMIN_URL });
        const withoutAdmin = await render({});

        // Assert
        expect(withAdmin).toContain(`href="${ADMIN_URL}/billing/reconciliation/refunds"`);
        expect(withoutAdmin).not.toContain('class="hospeda-btn"');
        expect(withoutAdmin).toContain('Facturación → Devoluciones propuestas');
        expect(withAdmin).toContain('Complemento sin suscripción');
        expect(withAdmin).toContain('Pago manual');
        expect(withAdmin).toContain('(moneda no registrada)');
        expect(withAdmin).not.toContain('centavos');
    });
});
