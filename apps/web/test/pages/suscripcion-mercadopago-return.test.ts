/** HOS-1979: the subscription page is wired as the Mercado Pago return screen. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/suscripcion/index.astro'),
    'utf8'
);

describe('mi-cuenta/suscripcion as the Mercado Pago return screen', () => {
    it('scrubs preapproval_id through the head-early slot', () => {
        expect(SOURCE).toContain('<StripMercadoPagoReturnParams slot="head-early" />');
    });

    it('reads the attempt status through the protected billing endpoint, never /admin', () => {
        expect(SOURCE).toContain('billingSubscriptionApi.read');
        expect(SOURCE).not.toContain('/admin/');
    });

    it('never forwards preapproval_id anywhere', () => {
        expect(SOURCE).not.toContain('preapproval_id');
    });

    it('mounts the return island only when our subscription id is present', () => {
        expect(SOURCE).toContain('{returnSubscriptionId && <SubscriptionReturn');
    });
});
