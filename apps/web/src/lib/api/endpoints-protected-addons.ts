/** Protected addon purchase endpoints for the account screen. */
import type {
    AddonFreeChoiceRequestSchema,
    AddonFreeChoiceResponseSchema,
    AddonOffersResponse,
    AddonPurchaseReadResponseSchema,
    AddonPurchaseRequestSchema,
    AddonPurchaseResponseSchema
} from '@repo/schemas';
import type { z } from 'zod';
import { apiClient } from './client';
import type { ApiResult } from './types';

const ADDONS = '/api/v1/protected/billing/addons';

/** Reads offers, starts purchases, resumes a purchase and chooses a free addon. */
export const billingAddonApi = {
    /**
     * Read the current addon catalog with this owner's free grant options.
     * @example const result = await billingAddonApi.offers();
     */
    offers(): Promise<ApiResult<AddonOffersResponse>> {
        return apiClient.getProtected({ path: `${ADDONS}/offers` });
    },
    /**
     * Start or replay an addon purchase.
     * @example const result = await billingAddonApi.purchase({ body });
     */
    purchase({
        body
    }: {
        readonly body: z.input<typeof AddonPurchaseRequestSchema>;
    }): Promise<ApiResult<z.infer<typeof AddonPurchaseResponseSchema>>> {
        return apiClient.postProtected({ path: `${ADDONS}/purchases`, body });
    },
    /**
     * Read one of this owner's purchase requests.
     * @example const result = await billingAddonApi.readPurchase({ orderRequestId });
     */
    readPurchase({
        orderRequestId
    }: {
        readonly orderRequestId: string;
    }): Promise<ApiResult<z.infer<typeof AddonPurchaseReadResponseSchema>>> {
        return apiClient.getProtected({
            path: `${ADDONS}/purchases/${encodeURIComponent(orderRequestId)}`
        });
    },
    /**
     * Choose an addon under an includes-addons grant.
     * @example const result = await billingAddonApi.chooseFree({ body });
     */
    chooseFree({
        body
    }: {
        readonly body: z.input<typeof AddonFreeChoiceRequestSchema>;
    }): Promise<ApiResult<z.infer<typeof AddonFreeChoiceResponseSchema>>> {
        return apiClient.postProtected({ path: `${ADDONS}/free-choices`, body });
    }
};
