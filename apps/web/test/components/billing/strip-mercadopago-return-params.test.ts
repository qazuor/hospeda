/**
 * @file strip-mercadopago-return-params.test.ts
 * @description HOS-1979: the shipped inline script removes `preapproval_id` from the
 * visible URL. The test executes the exact script body found in the component.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const SOURCE = readFileSync(
    resolve(__dirname, '../../../src/components/billing/StripMercadoPagoReturnParams.astro'),
    'utf8'
);
const SCRIPT_BODY = /<script is:inline>([\s\S]*?)<\/script>/.exec(SOURCE)?.[1] ?? '';
const PATH = '/es/mi-cuenta/suscripcion/';
const ID = '123e4567-e89b-42d3-a456-426614174000';

function run(): void {
    new Function(SCRIPT_BODY)();
}

describe('StripMercadoPagoReturnParams', () => {
    beforeEach(() => {
        window.history.replaceState({}, '', PATH);
    });
    afterAll(() => {
        window.history.replaceState(null, '', '/');
    });

    it('ships a script body', () => {
        expect(SCRIPT_BODY).toContain('preapproval_id');
    });

    it('removes preapproval_id and keeps our subscription id', () => {
        window.history.replaceState({}, '', `${PATH}?subscription=${ID}&preapproval_id=abc123`);

        run();

        expect(window.location.search).toBe(`?subscription=${ID}`);
        expect(window.location.pathname).toBe(PATH);
    });

    it('cleans the tail when the provider glued its query onto ours', () => {
        window.history.replaceState({}, '', `${PATH}?subscription=${ID}?preapproval_id=abc123`);

        run();

        expect(window.location.search).toBe(`?subscription=${ID}`);
        expect(window.location.search).not.toContain('preapproval_id');
    });

    it('is a no-op without the parameter', () => {
        window.history.replaceState({}, '', `${PATH}?subscription=${ID}#top`);

        expect(() => run()).not.toThrow();
        expect(window.location.search).toBe(`?subscription=${ID}`);
        expect(window.location.hash).toBe('#top');
    });
});
