import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createBillingReconciliationRenderers } from '../../../src/services/outbox/billing-reconciliation-renderers.js';
import {
    openMarkKey,
    RECONCILIATION_REASON_COPY,
    RECONCILIATION_SUMMARY_SUBJECT,
    type ReconciliationSubjectsReader
} from '../../../src/templates/billing/index.js';
import { row } from './outbox-batch.harness.js';

const SUB_ID = '2f04c1ad-a8dd-4fea-82d9-76a9910af267';
const MARK_ID = '9b1c0000-0000-4000-8000-000000000001';
const payload = {
    windowId: 'window-1',
    coversFrom: '2026-10-01T00:00:00.000Z',
    closesAt: '2026-10-02T00:00:00.000Z',
    windowMinutes: 60,
    totals: { events: 3 },
    marks: [
        {
            reason: 'PAGO_TARDIO_RECHAZADO',
            subjectType: 'subscription',
            subjectId: SUB_ID,
            count: 2
        }
    ],
    escalations: [],
    underCharges: [],
    pauseGifts: [],
    omitted: { marks: 0, escalations: 0, underCharges: 0, pauseGifts: 0 }
};
const bareLine = `PAGO_TARDIO_RECHAZADO · subscription ${SUB_ID} · 2 veces`;

const resolved: ReconciliationSubjectsReader = async () => ({
    subscriptions: new Map([
        [
            SUB_ID,
            {
                holderName: 'Ana Pérez',
                holderEmail: 'ana@example.com',
                vertical: 'venue',
                planName: 'Pro',
                cycle: 'monthly',
                amountMinor: 1850000,
                currency: 'ARS',
                status: 'GRACE_PERIOD',
                listingNames: ['Parrilla El Puerto']
            }
        ]
    ]),
    addonInstances: new Map(),
    openMarks: new Map([
        [
            openMarkKey({ subjectId: SUB_ID, reason: 'PAGO_TARDIO_RECHAZADO' }),
            { markId: MARK_ID, placedAt: '2026-10-01T12:00:00.000Z' }
        ]
    ])
});

async function render(input: Parameters<typeof createBillingReconciliationRenderers>[0]) {
    const renderers = createBillingReconciliationRenderers(input);
    const result = await renderers['billing.reconciliation-summary']!({
        row: row({ template: 'billing.reconciliation-summary', payload })
    });
    return { subject: result.subject, html: renderToStaticMarkup(result.react) };
}

describe('HOS-1971 reconciliation summary enrichment', () => {
    it('renders an enriched line with holder, plan, amount, status, reason, link and short id', async () => {
        // Arrange + Act
        const { html, subject } = await render({
            siteUrl: 'https://hospeda.test',
            readSubjects: resolved,
            adminUrl: 'https://admin.hospeda.test/'
        });
        // Assert
        expect(subject).toBe(RECONCILIATION_SUMMARY_SUBJECT);
        expect(html).toContain('Ana Pérez &lt;ana@example.com&gt;');
        expect(html).toContain('fichas: Parrilla El Puerto');
        expect(html).toContain('Comer y salir Pro mensual $18.500,00');
        expect(html).toContain('estado: en gracia');
        expect(html).toContain('Pago tardío rechazado');
        expect(html).toContain('Qué hacer:');
        expect(html).toContain('ref. 2f04c1ad');
        expect(html).toContain(
            `https://admin.hospeda.test/billing/reconciliation/${MARK_ID}/events`
        );
        expect(html).not.toContain(bareLine);
    });

    it('falls back to the bare line when the subject cannot be resolved', async () => {
        // Arrange
        const empty: ReconciliationSubjectsReader = async () => ({
            subscriptions: new Map(),
            addonInstances: new Map(),
            openMarks: new Map()
        });
        // Act
        const { html } = await render({ siteUrl: 'https://hospeda.test', readSubjects: empty });
        // Assert
        expect(html).toContain(bareLine);
        expect(html).not.toContain('Qué hacer');
    });

    it('still renders when the lookup throws, and reports the failure', async () => {
        // Arrange
        const failing: ReconciliationSubjectsReader = async () => {
            throw new Error('db down');
        };
        const onEnrichmentError = vi.fn();
        // Act
        const { html } = await render({
            siteUrl: 'https://hospeda.test',
            readSubjects: failing,
            onEnrichmentError
        });
        // Assert
        expect(html).toContain(bareLine);
        expect(onEnrichmentError).toHaveBeenCalledTimes(1);
    });

    it('asks the reader once for all subjects of the mail', async () => {
        // Arrange
        const reader = vi.fn(resolved);
        // Act
        await render({ siteUrl: 'https://hospeda.test', readSubjects: reader });
        // Assert
        expect(reader).toHaveBeenCalledTimes(1);
        expect(reader).toHaveBeenCalledWith({ subscriptionIds: [SUB_ID], addonInstanceIds: [] });
    });

    it('marks the environment in the header, and not in production', async () => {
        // Arrange + Act
        const staging = await render({
            siteUrl: 'https://hospeda.test',
            environmentLabel: 'STAGING'
        });
        const prod = await render({ siteUrl: 'https://hospeda.test' });
        // Assert
        expect(staging.html).toContain('[STAGING] Resumen de conciliación de billing');
        expect(staging.html).toContain('Ambiente: STAGING');
        expect(prod.html).not.toContain('[STAGING]');
        expect(prod.html).not.toContain('Ambiente:');
        expect(prod.html).toContain(bareLine);
    });

    it('has plain-words copy for every closed reason', () => {
        for (const copy of Object.values(RECONCILIATION_REASON_COPY)) {
            expect(copy.label.length).toBeGreaterThan(0);
            expect(copy.action.length).toBeGreaterThan(0);
        }
    });
});
