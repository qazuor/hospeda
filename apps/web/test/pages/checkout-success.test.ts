/**
 * @file checkout-success.test.ts
 * @description Source-level assertions for the checkout success page
 * (HOS-151 Bug A). Astro pages cannot be rendered in Vitest, so we assert on
 * the source: the immediate (annual / trial / comp) path stays a static
 * CheckoutResult, and the recurring-preapproval path mounts the polling island.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/suscriptores/checkout/success.astro'),
    'utf8'
);

describe('checkout/success.astro (HOS-151 Bug A)', () => {
    it('imports the CheckoutStatusPoller island', () => {
        expect(src).toContain(
            "import { CheckoutStatusPoller } from '@/components/billing/CheckoutStatusPoller.client'"
        );
    });

    it('branches on an immediate-success signal (approved / trial / comp)', () => {
        expect(src).toContain("collectionStatus === 'approved'");
        expect(src).toContain('isImmediateSuccess');
    });

    it('mounts the poller island client:load for the non-immediate (recurring preapproval) path', () => {
        expect(src).toMatch(/<CheckoutStatusPoller\s+client:load/);
        expect(src).toContain('miCuentaUrl={miCuentaUrl}');
    });

    it('keeps the static CheckoutResult for the immediate-success path', () => {
        expect(src).toContain('<CheckoutResult');
        expect(src).toContain('variant="success"');
    });
});
