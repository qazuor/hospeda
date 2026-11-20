/**
 * HOS-2179 (owner decision): the composition root lets the adapter accept a plain-http page
 * return URL on localhost only outside production, reading the validated API env. Production
 * keeps https only.
 *
 * The validated env never holds an unset NODE_ENV: the schema defaults it to `development`.
 * So production safety does not come from this check alone but from the API image, which
 * pins `ENV NODE_ENV=production` in its runner stage. Both facts are asserted below.
 */
import { readFileSync } from 'node:fs';
import { createAdjustableClock } from '@repo/test-clock';
import { describe, expect, it, vi } from 'vitest';

const { env } = vi.hoisted(() => ({
    env: {
        NODE_ENV: 'development' as 'development' | 'production' | 'test',
        HOSPEDA_MERCADO_PAGO_API_BASE_URL: 'http://127.0.0.1:9/unreachable',
        HOSPEDA_MERCADO_PAGO_ACCESS_TOKEN: 'test-token',
        HOSPEDA_MERCADO_PAGO_TIMEOUT: 200
    }
}));
vi.mock('../../src/utils/env', () => ({ env }));
vi.mock('../../src/utils/mp-traffic-governor', () => ({
    getMercadoPagoTrafficGovernor: () => undefined
}));

import { ApiEnvBaseSchema } from '../../src/utils/env-schema';
import { defaultPaymentProvider } from '../../src/utils/payment-provider';

const clock = createAdjustableClock({ start: new Date('2026-11-19T12:00:00.000Z') });
const page = {
    reference: 'p-1',
    idempotencyKey: 'page:p-1',
    amount: { amountMinor: 1_000_000, currency: 'ARS' },
    reason: 'Destacado 7 días',
    returnUrl: 'http://localhost:4321/es/mi-cuenta/complementos/',
    expiresAt: '2026-11-19T13:00:00.000Z'
};

async function failureCodeFor(nodeEnv: typeof env.NODE_ENV): Promise<unknown> {
    env.NODE_ENV = nodeEnv;
    const provider = defaultPaymentProvider({ clock });
    try {
        await provider.requestOneTimePayment(page);
        return undefined;
    } catch (error) {
        return (error as { code?: unknown }).code;
    }
}

describe('default provider: local http return URL by environment (HOS-2179)', () => {
    it('refuses a localhost http return URL in production, before any call', async () => {
        expect(await failureCodeFor('production')).toBe('INVALID_INPUT');
    });

    it.each([
        'development',
        'test'
    ] as const)('lets a localhost http return URL through in %s (it reaches the network)', async (nodeEnv) => {
        const code = await failureCodeFor(nodeEnv);
        expect(code).not.toBe('INVALID_INPUT');
        expect(code).toBeDefined();
    });
});

describe('what keeps production on https (HOS-2179)', () => {
    it('an unset NODE_ENV validates as development, so the check alone would allow http', () => {
        const shape = ApiEnvBaseSchema.shape.NODE_ENV;
        expect(shape.parse(undefined)).toBe('development');
    });

    it('the API image pins NODE_ENV=production in the stage that runs the server', () => {
        const dockerfile = readFileSync(new URL('../../Dockerfile', import.meta.url), 'utf8');
        const runner = dockerfile.split(/^FROM /m).find((stage) => /\bAS runner\b/.test(stage));
        expect(runner).toBeDefined();
        expect(runner).toMatch(/^ENV NODE_ENV=production$/m);
    });
});
