import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkCommercialValues } from '../check-commercial-values-in-code.ts';

const roots: string[] = [];
afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('TEST:B2:3 — G7 rejects a commercial value in code', () => {
    it('names a monthly price constant used by a billing service', () => {
        const root = mkdtempSync(join(tmpdir(), 'g7-'));
        roots.push(root);
        for (const folder of [
            'packages/billing/src',
            'packages/payments/src',
            'packages/service-core/src/services/billing'
        ]) {
            mkdirSync(join(root, folder), { recursive: true });
        }
        writeFileSync(
            join(root, 'packages/payments/src/plan-price.ts'),
            'export const BASIC_MONTHLY_PRICE = 12345;\n'
        );
        writeFileSync(
            join(root, 'packages/service-core/src/services/billing/read-price.ts'),
            "import { BASIC_MONTHLY_PRICE } from '@repo/payments';\nexport const readPrice = () => BASIC_MONTHLY_PRICE;\n"
        );

        expect(checkCommercialValues(root)).toEqual([
            'packages/payments/src/plan-price.ts:1: commercial value BASIC_MONTHLY_PRICE = 12345 lives in code'
        ]);
    });

    it('passes with a version-based DB read', () => {
        const root = mkdtempSync(join(tmpdir(), 'g7-'));
        roots.push(root);
        for (const folder of [
            'packages/billing/src',
            'packages/payments/src',
            'packages/service-core/src/services/billing'
        ]) {
            mkdirSync(join(root, folder), { recursive: true });
        }
        writeFileSync(
            join(root, 'packages/service-core/src/services/billing/read-price.ts'),
            'export const readPrice = (row: { amount: number }) => row.amount;\n'
        );
        expect(checkCommercialValues(root)).toEqual([]);
    });
});
