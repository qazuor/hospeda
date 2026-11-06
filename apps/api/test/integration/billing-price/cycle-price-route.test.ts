import { PROVIDER_AMOUNT_CEILING_MINOR, PROVIDER_AMOUNT_FLOOR_MINOR } from '@repo/service-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../../src/app.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';
import {
    actBody,
    actorHeaders,
    PRICE_PATH,
    previewBody,
    previewPath,
    priceState,
    seedActor,
    seedPriceVersion
} from './cycle-price-fixtures.js';

const audit = vi.hoisted(() => vi.fn());
vi.mock('../../../src/utils/audit-logger', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    auditLog: audit
}));

let app: ReturnType<typeof initApp>;
let actorId: string;
const amount = PROVIDER_AMOUNT_FLOOR_MINOR + 500;

async function post(path: string, body: Record<string, unknown>, allowed = true) {
    return app.request(path, {
        method: 'POST',
        headers: actorHeaders(actorId, allowed),
        body: JSON.stringify(body)
    });
}

async function expectRefusal(args: {
    path: string;
    body: Record<string, unknown>;
    planVersionId: string;
    status: number;
    code: string;
    reason?: string;
    message?: string;
    allowed?: boolean;
}) {
    const before = await priceState(args.planVersionId);
    const response = await post(args.path, args.body, args.allowed);
    const payload = await response.json();
    expect(response.status, JSON.stringify(payload)).toBe(args.status);
    expect(payload.error.code).toBe(args.code);
    if (args.reason) expect(payload.error.reason).toBe(args.reason);
    if (args.message) expect(payload.error.message).toBe(args.message);
    expect(await priceState(args.planVersionId)).toEqual(before);
}

describe('TEST:B2:5 cycle price admin route', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp();
        actorId = await seedActor();
    });
    afterAll(async () => testDb.teardown());

    it('rejects an ADMIN before the handler on preview and act', async () => {
        const { planVersionId } = await seedPriceVersion();
        for (const [path, body] of [
            [previewPath, previewBody(planVersionId, amount)],
            [PRICE_PATH, actBody(planVersionId, amount)]
        ] as const) {
            await expectRefusal({
                path,
                body,
                planVersionId,
                status: 403,
                code: 'FORBIDDEN',
                allowed: false
            });
            await expectRefusal({
                path,
                body: { ...body, amount: amount + 0.5 },
                planVersionId,
                status: 403,
                code: 'FORBIDDEN',
                allowed: false
            });
        }
    });

    it('rejects malformed amount, cycle, UUID and false confirmation at the route boundary', async () => {
        const { planVersionId } = await seedPriceVersion();
        const bad = [
            [previewPath, previewBody(planVersionId, amount + 0.5)],
            [previewPath, previewBody(planVersionId, amount, 'weekly')],
            [previewPath, previewBody('not-a-uuid', amount)],
            [PRICE_PATH, { ...actBody(planVersionId, amount), confirmed: false }]
        ] as const;
        for (const [path, body] of bad)
            await expectRefusal({
                path,
                body,
                planVersionId,
                status: 400,
                code: 'VALIDATION_ERROR'
            });
    });

    it('answers 404 for a missing plan version without a write', async () => {
        const unknown = crypto.randomUUID();
        await expectRefusal({
            path: PRICE_PATH,
            body: actBody(unknown, amount),
            planVersionId: unknown,
            status: 404,
            code: 'NOT_FOUND',
            reason: 'PLAN_VERSION_NOT_FOUND'
        });
    });

    it('reports the provider floor in preview and act with its exact message', async () => {
        const { planVersionId } = await seedPriceVersion();
        const below = PROVIDER_AMOUNT_FLOOR_MINOR - 1;
        for (const [path, body] of [
            [previewPath, previewBody(planVersionId, below)],
            [PRICE_PATH, actBody(planVersionId, below)]
        ] as const) {
            await expectRefusal({
                path,
                body,
                planVersionId,
                status: 422,
                code: 'VALIDATION_ERROR',
                reason: 'CYCLE_PRICE_BELOW_PROVIDER_MINIMUM',
                message: 'El monto mínimo que acepta Mercado Pago es ARS 15.'
            });
        }
    });

    it('rejects a monthly cycle no longer than the version grace', async () => {
        const { planVersionId } = await seedPriceVersion({ graceDays: 28 });
        await expectRefusal({
            path: PRICE_PATH,
            body: actBody(planVersionId, amount),
            planVersionId,
            status: 422,
            code: 'VALIDATION_ERROR',
            reason: 'CYCLE_NOT_LONGER_THAN_GRACE'
        });
    });

    it('previews and sets a price for a customer-free version, with audit and event', async () => {
        const { planVersionId } = await seedPriceVersion();
        const preview = await post(previewPath, previewBody(planVersionId, amount));
        const confirmation = (await preview.json()).data;
        expect(preview.status).toBe(200);
        expect(confirmation).toMatchObject({
            planVersionId,
            cycle: 'monthly',
            previousAmount: null,
            newAmount: amount,
            customersReached: 0
        });
        expect(confirmation.message).toContain('No alcanza a ningún cliente');
        expect(await priceState(planVersionId)).toEqual({ options: [], events: [] });
        const act = await post(PRICE_PATH, actBody(planVersionId, amount));
        const result = (await act.json()).data;
        expect(act.status).toBe(200);
        expect(result.billingOption).toMatchObject({ planVersionId, cycle: 'monthly', amount });
        const state = await priceState(planVersionId);
        expect(state.options).toHaveLength(1);
        expect(state.events).toHaveLength(1);
        expect(state.events[0]?.changes).toContainEqual({
            field: 'billing_option.amount',
            old: null,
            new: amount
        });
        expect(
            audit.mock.calls.filter(
                ([call]) =>
                    call.resourceId === result.billingOption.id &&
                    call.metadata?.administrativeAction === 'ACC_19'
            )
        ).toHaveLength(1);
    });

    it('PM-334 rejects non-sellable versions and amounts above RP3 ceiling in both routes', async () => {
        const { planVersionId: unsellable } = await seedPriceVersion({ sellable: false });
        for (const [path, body] of [
            [previewPath, previewBody(unsellable, amount)],
            [PRICE_PATH, actBody(unsellable, amount)]
        ] as const) {
            await expectRefusal({
                path,
                body,
                planVersionId: unsellable,
                status: 422,
                code: 'VALIDATION_ERROR',
                reason: 'PLAN_VERSION_NOT_SELLABLE'
            });
        }
        const { planVersionId } = await seedPriceVersion();
        const above = PROVIDER_AMOUNT_CEILING_MINOR + 1;
        for (const [path, body] of [
            [previewPath, previewBody(planVersionId, above)],
            [PRICE_PATH, actBody(planVersionId, above)]
        ] as const) {
            await expectRefusal({
                path,
                body,
                planVersionId,
                status: 422,
                code: 'VALIDATION_ERROR',
                reason: 'CYCLE_PRICE_ABOVE_PROVIDER_MAXIMUM'
            });
        }
    });
});
