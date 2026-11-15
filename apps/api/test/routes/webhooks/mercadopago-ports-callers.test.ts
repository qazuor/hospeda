import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('TEST:B8b:24 S38 production receiver callers', () => {
    it.each([
        '../../../src/routes/webhooks/mercadopago.ts',
        '../../../src/routes/billing-refund/admin/settle-external-charge.ts'
    ])('passes the request collector to %s', (file) => {
        const source = readFileSync(new URL(file, import.meta.url), 'utf8');
        expect(source).toMatch(
            /buildMercadoPagoNoticePorts\(\{ scheduledChangeApplier: collector\.applier \}\)/
        );
        expect(source).toContain('await collector.finish()');
        expect(source).toContain('collector.discard()');
    });
});
