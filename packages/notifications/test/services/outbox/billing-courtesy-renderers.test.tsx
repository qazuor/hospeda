import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createBillingCourtesyRenderers } from '../../../src/services/outbox/billing-courtesy-renderers.js';
import { COURTESY_REVOKED_SUBJECT } from '../../../src/templates/billing/courtesy-revoked.js';
import { row } from './outbox-batch.harness.js';

const renderer = createBillingCourtesyRenderers()['billing.courtesy-revoked']!;

describe('TEST:B9b:14 courtesy revocation mail', () => {
    it('renders the resumed subscription and next charge date', async () => {
        const result = await renderer({
            row: row({
                template: 'billing.courtesy-revoked',
                payload: { nextChargeOn: '2026-11-14' }
            })
        });
        const html = renderToStaticMarkup(result.react);
        expect(result.subject).toBe(COURTESY_REVOKED_SUBJECT);
        expect(html).toContain('Tu cortesía terminó hoy');
        expect(html).toContain('14 de noviembre de 2026');
    });
    it('rejects incomplete charge dates', () => {
        expect(() =>
            renderer({ row: row({ template: 'billing.courtesy-revoked', payload: {} }) })
        ).toThrow(TypeError);
    });
});
