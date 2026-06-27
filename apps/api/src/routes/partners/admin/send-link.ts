import { PermissionEnum } from '@repo/schemas';
/**
 * Admin send payment link endpoint
 * Generates a QZPay payment link for a partner
 */
import { PartnerSubscriptionStatusEnum } from '@repo/schemas';
import { PartnerService } from '@repo/service-core';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { getQZPayBilling } from '../../../middlewares/billing';
import {
    SubscriptionCheckoutError,
    initiatePartnerMonthlySubscription
} from '../../../services/subscription-checkout.service';
import { getActorFromContext } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createAdminRoute } from '../../../utils/route-factory';

function buildNotificationUrl(): string {
    return `${env.HOSPEDA_API_URL}/api/v1/webhooks/mercadopago`;
}

function buildPaymentMethodReturnUrl(): string {
    return `${env.HOSPEDA_ADMIN_URL}/partners`;
}

function buildPartnerCustomerExternalId(partnerId: string): string {
    return `partner:${partnerId}`;
}

function buildPartnerCustomerEmail(partnerId: string): string {
    return `partner-${partnerId}@partners.hospeda.invalid`;
}

function mapCheckoutErrorToHttp(error: SubscriptionCheckoutError): HTTPException {
    switch (error.code) {
        case 'PLAN_NOT_FOUND':
        case 'NO_MONTHLY_PRICE':
            return new HTTPException(404, { message: error.message });
        case 'MISSING_INIT_POINT':
            return new HTTPException(500, { message: error.message });
        default:
            return new HTTPException(500, { message: error.message });
    }
}

/**
 * POST /api/v1/admin/partners/{id}/send-link
 * Send payment link - Admin endpoint
 * Requires PARTNER_MANAGE permission
 */
export const adminSendPaymentLinkRoute = createAdminRoute({
    method: 'post',
    path: '/{id}/send-link',
    summary: 'Send payment link for partner (admin)',
    description: 'Generates a QZPay payment link for a partner',
    tags: ['Partners'],
    requiredPermissions: [PermissionEnum.PARTNER_MANAGE],
    requestParams: { id: z.string().uuid() },
    responseSchema: z.object({
        paymentUrl: z.string().url(),
        planId: z.string().uuid()
    }),
    handler: async (ctx, params) => {
        const partnerService = new PartnerService({ logger: apiLogger });
        const actor = getActorFromContext(ctx);
        const id = params.id as string;

        const billing = getQZPayBilling();
        if (!billing) {
            throw new HTTPException(503, { message: 'Billing service is not available' });
        }

        const partnerResult = await partnerService.getById(actor, id);
        if (partnerResult.error || !partnerResult.data) {
            throw new HTTPException(404, { message: 'Partner not found' });
        }

        const partner = partnerResult.data;
        if (!partner.planId) {
            throw new HTTPException(422, {
                message:
                    'Partner has no billing plan assigned. Set a partner plan before generating a payment link.'
            });
        }

        const customerExternalId = buildPartnerCustomerExternalId(partner.id);
        let customer = await billing.customers.getByExternalId(customerExternalId);

        if (!customer) {
            customer = await billing.customers.create({
                externalId: customerExternalId,
                email: buildPartnerCustomerEmail(partner.id),
                name: partner.name,
                metadata: {
                    source: 'partner-admin',
                    createdBy: 'partner-send-link-route',
                    partnerId: partner.id
                }
            });
        }

        try {
            const result = await initiatePartnerMonthlySubscription({
                customerId: customer.id,
                planId: partner.planId,
                partnerId: partner.id,
                billing,
                urls: {
                    paymentMethodReturnUrl: buildPaymentMethodReturnUrl(),
                    notificationUrl: buildNotificationUrl()
                }
            });

            const updateResult = await partnerService.update(actor, id, {
                subscriptionId: result.localSubscriptionId,
                subscriptionStatus: PartnerSubscriptionStatusEnum.PENDING
            });

            if (updateResult.error) {
                apiLogger.warn(
                    { partnerId: id, error: updateResult.error.message },
                    'Partner checkout started but the local partner row could not be updated to pending'
                );
            }

            return {
                paymentUrl: result.checkoutUrl,
                planId: partner.planId
            };
        } catch (error) {
            if (error instanceof SubscriptionCheckoutError) {
                throw mapCheckoutErrorToHttp(error);
            }
            throw error;
        }
    }
});
