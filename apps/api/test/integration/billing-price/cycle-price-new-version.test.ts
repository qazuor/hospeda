import { eq, getDb, subscriptions } from '@repo/db';
import { PROVIDER_AMOUNT_FLOOR_MINOR } from '@repo/service-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../src/app.js';
import { validateApiEnv } from '../../../src/utils/env.js';
import { testDb } from '../../e2e/setup/test-database.js';
import { publishBody, publishUrl } from '../plan-publication/plan-publication.helpers.js';
import {
    actBody,
    actorHeaders,
    anchoredPrice,
    PRICE_PATH,
    previewBody,
    previewPath,
    priceState,
    seedActor,
    seedPriceVersion,
    startPriceCustomer
} from './cycle-price-fixtures.js';

let app: ReturnType<typeof initApp>;
let actorId: string;
const firstPrice = PROVIDER_AMOUNT_FLOOR_MINOR + 500;
const secondPrice = firstPrice + 500;
const newVersionPrice = secondPrice + 500;

async function post(path: string, body: Record<string, unknown>) {
    const response = await app.request(path, {
        method: 'POST',
        headers: actorHeaders(actorId),
        body: JSON.stringify(body)
    });
    return { response, payload: await response.json() };
}

async function setPrice(
    planVersionId: string,
    amount: number,
    expectedPreviousAmount: number | null
) {
    const { response, payload } = await post(
        PRICE_PATH,
        actBody(planVersionId, amount, expectedPreviousAmount)
    );
    expect(response.status, JSON.stringify(payload)).toBe(200);
    return payload.data;
}

describe('TEST:B2:6 action 19, V2 publication and real subscription anchors', () => {
    beforeAll(async () => {
        process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
        await testDb.setup();
        validateApiEnv();
        app = initApp();
        actorId = await seedActor();
    });
    afterAll(async () => testDb.teardown());

    it('keeps Juan on V1 while a new signup reads the published V2 price', async () => {
        const { planId, planVersionId: v1, rank } = await seedPriceVersion({ graceDays: 10 });

        const preview1 = await post(previewPath, previewBody(v1, firstPrice));
        expect(preview1.response.status).toBe(200);
        expect(preview1.payload.data).toMatchObject({
            previousAmount: null,
            newAmount: firstPrice,
            customersReached: 0
        });
        const first = await setPrice(v1, firstPrice, null);
        const preview2 = await post(previewPath, previewBody(v1, secondPrice));
        expect(preview2.response.status).toBe(200);
        expect(preview2.payload.data.previousAmount).toBe(firstPrice);
        const second = await setPrice(v1, secondPrice, firstPrice);
        expect(second.billingOption.id).toBe(first.billingOption.id);
        const v1State = await priceState(v1);
        expect(v1State.options).toHaveLength(1);
        expect(v1State.options[0]?.amount).toBe(secondPrice);
        expect(v1State.events).toHaveLength(2);
        expect(
            v1State.events.map((row) =>
                row.changes.find((change) => change.field === 'billing_option.amount')
            )
        ).toEqual(
            expect.arrayContaining([
                { field: 'billing_option.amount', old: null, new: firstPrice },
                { field: 'billing_option.amount', old: firstPrice, new: secondPrice }
            ])
        );

        const juan = await startPriceCustomer({
            billingOptionId: second.billingOption.id,
            name: 'juan',
            activate: true
        });
        const [juanRow] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, juan.subscriptionId));
        expect(juanRow?.status).toBe('ACTIVE');
        expect(juanRow?.planVersionId).toBe(v1);

        for (const [path, body] of [
            [previewPath, previewBody(v1, newVersionPrice)],
            [PRICE_PATH, actBody(v1, newVersionPrice, secondPrice)]
        ] as const) {
            const { response, payload } = await post(path, body);
            expect(response.status, JSON.stringify(payload)).toBe(409);
            expect(payload.error).toMatchObject({
                code: 'ALREADY_EXISTS',
                reason: 'PLAN_VERSION_HAS_CUSTOMERS'
            });
        }
        expect(await priceState(v1)).toEqual(v1State);
        expect((await anchoredPrice(juan.subscriptionId)).option?.amount).toBe(secondPrice);

        const published = await post(
            publishUrl({ planId }),
            JSON.parse(
                publishBody({
                    overrides: {
                        rank: rank + 1,
                        graceDays: 10,
                        sellable: true,
                        trialDays: 0,
                        allowsPause: false
                    }
                })
            )
        );
        expect(published.response.status, JSON.stringify(published.payload)).toBe(201);
        const v2 = published.payload.data.id as string;
        expect(v2).toMatch(/^[0-9a-f-]{36}$/i);
        const v2Preview = await post(previewPath, previewBody(v2, newVersionPrice));
        expect(v2Preview.response.status).toBe(200);
        expect(v2Preview.payload.data.previousAmount).toBeNull();
        const third = await setPrice(v2, newVersionPrice, null);
        expect(third.billingOption.planVersionId).toBe(v2);
        expect((await priceState(v2)).options[0]?.amount).toBe(newVersionPrice);

        const ana = await startPriceCustomer({
            billingOptionId: third.billingOption.id,
            name: 'ana'
        });
        expect(await anchoredPrice(ana.subscriptionId)).toMatchObject({
            planVersionId: v2,
            option: { amount: newVersionPrice }
        });
        expect(await anchoredPrice(juan.subscriptionId)).toMatchObject({
            planVersionId: v1,
            option: { amount: secondPrice }
        });
        const [juanAfter] = await getDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, juan.subscriptionId));
        expect(juanAfter?.planVersionId).toBe(v1);
        const v2State = await priceState(v2);
        const denied = await post(PRICE_PATH, actBody(v2, newVersionPrice + 500, newVersionPrice));
        expect(denied.response.status, JSON.stringify(denied.payload)).toBe(409);
        expect(denied.payload.error.reason).toBe('PLAN_VERSION_HAS_CUSTOMERS');
        expect(await priceState(v2)).toEqual(v2State);
    });
});
