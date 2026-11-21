/**
 * HOS-2518: when A1 collided on the purchase identity and no purchase took it within the wait,
 * the route answers a 503 with its own reason and localized copy, never a 500 and never the
 * service's English message.
 */
import { trans } from '@repo/i18n';
import { ServiceErrorCode } from '@repo/schemas';
import { PURCHASE_IDENTITY_BUSY_REASON, ServiceError } from '@repo/service-core';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { testDb } from '../../e2e/setup/test-database';
import { ownerHeaders, purchaseApp } from './support/addon-purchase-route-fixtures';

const { purchaseAddonMock } = vi.hoisted(() => ({ purchaseAddonMock: vi.fn() }));

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return { ...actual, purchaseAddon: purchaseAddonMock };
});

beforeAll(async () => {
    process.env.HOSPEDA_ALLOW_MOCK_ACTOR = 'true';
    await testDb.setup();
});
afterAll(async () => testDb.teardown());

describe('HOS-2518 the purchase identity stayed busy', () => {
    it('answers 503 with the PURCHASE_IDENTITY_BUSY reason and its localized copy', async () => {
        // Arrange
        purchaseAddonMock.mockRejectedValueOnce(
            new ServiceError(
                ServiceErrorCode.SERVICE_UNAVAILABLE,
                'Another purchase of this addon was changing; try again',
                undefined,
                PURCHASE_IDENTITY_BUSY_REASON
            )
        );
        const { app } = purchaseApp();
        const ownerId = crypto.randomUUID();

        // Act
        const response = await app.request('/api/v1/protected/billing/addons/purchases', {
            method: 'POST',
            headers: ownerHeaders(ownerId),
            body: JSON.stringify({
                productId: crypto.randomUUID(),
                targetId: null,
                orderRequestId: crypto.randomUUID(),
                addonVersionId: crypto.randomUUID()
            })
        });

        // Assert
        expect(purchaseAddonMock).toHaveBeenCalledTimes(1);
        expect(response.status).toBe(503);
        const body = (await response.json()) as {
            error: { code: string; reason: string; message: string };
        };
        expect(body.error).toMatchObject({
            code: ServiceErrorCode.SERVICE_UNAVAILABLE,
            reason: PURCHASE_IDENTITY_BUSY_REASON,
            message: trans.es['billing.addonPurchaseApi.identityBusy']
        });
        expect(body.error.message).not.toMatch(/Another purchase/);
    });
});
