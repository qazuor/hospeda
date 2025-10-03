import type { ILogger } from '@repo/logger';
import type { MercadoPagoClient } from '../clients/mercado-pago.client.js';
import type { PaymentService } from '../services/payment.service.js';
import type { SubscriptionService } from '../services/subscription.service.js';
import type { WebhookProcessingResult } from '../types/index.js';

/**
 * Webhook payload from Mercado Pago
 */
export interface WebhookPayload {
    /** Webhook action */
    action: string;
    /** API version */
    api_version: string;
    /** Data containing the resource ID */
    data: {
        id: string;
    };
    /** Date created */
    date_created: string;
    /** Webhook ID */
    id: number;
    /** Live mode flag */
    live_mode: boolean;
    /** Type of notification */
    type: string;
    /** User ID */
    user_id: string;
}

/**
 * Webhook handler for processing Mercado Pago notifications
 */
export class WebhookHandler {
    private mercadoPagoClient: MercadoPagoClient;
    private paymentService: PaymentService;
    private subscriptionService: SubscriptionService;
    private logger: ILogger;

    /**
     * Creates a new WebhookHandler instance
     * @param mercadoPagoClient - Mercado Pago client
     * @param paymentService - Payment service
     * @param subscriptionService - Subscription service
     * @param logger - Logger instance
     */
    constructor(
        mercadoPagoClient: MercadoPagoClient,
        paymentService: PaymentService,
        subscriptionService: SubscriptionService,
        logger: ILogger
    ) {
        this.mercadoPagoClient = mercadoPagoClient;
        this.paymentService = paymentService;
        this.subscriptionService = subscriptionService;
        this.logger = logger;
    }

    /**
     * Processes a webhook notification
     * @param payload - Webhook payload
     * @param signature - Webhook signature for validation
     * @returns Processing result
     */
    async processWebhook(
        payload: WebhookPayload,
        signature?: string
    ): Promise<WebhookProcessingResult> {
        try {
            this.logger.info(
                {
                    type: payload.type,
                    action: payload.action,
                    resourceId: payload.data.id,
                    webhookId: payload.id
                },
                'Processing webhook notification'
            );

            // Validate webhook signature if provided
            if (signature) {
                const isValid = this.mercadoPagoClient.validateWebhookSignature(
                    JSON.stringify(payload),
                    signature
                );

                if (!isValid) {
                    throw new Error('Invalid webhook signature');
                }
            }

            const actions: string[] = [];
            let paymentId: string | undefined;
            let subscriptionId: string | undefined;

            // Process based on notification type
            switch (payload.type) {
                case 'payment': {
                    const paymentResult = await this.handlePaymentNotification(payload);
                    paymentId = paymentResult.paymentId;
                    actions.push(`Payment ${payload.action}: ${paymentResult.status}`);
                    break;
                }

                case 'subscription':
                case 'preapproval': {
                    const subscriptionResult = await this.handleSubscriptionNotification(payload);
                    subscriptionId = subscriptionResult.subscriptionId;
                    actions.push(`Subscription ${payload.action}: ${subscriptionResult.status}`);
                    break;
                }

                case 'plan':
                    actions.push(`Plan ${payload.action} - no action required`);
                    break;

                default:
                    this.logger.warn({ type: payload.type }, 'Unknown webhook type');
                    actions.push(`Unknown type ${payload.type} - ignored`);
            }

            this.logger.info(
                {
                    type: payload.type,
                    actions,
                    paymentId,
                    subscriptionId
                },
                'Webhook processed successfully'
            );

            return {
                success: true,
                // biome-ignore lint/suspicious/noExplicitAny: Temporary workaround for branded types
                paymentId: paymentId as any,
                // biome-ignore lint/suspicious/noExplicitAny: Temporary workaround for branded types
                subscriptionId: subscriptionId as any,
                actions
            };
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    payload
                },
                'Failed to process webhook'
            );

            return {
                success: false,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                actions: ['Error processing webhook']
            };
        }
    }

    /**
     * Handles payment notifications
     * @param payload - Webhook payload
     * @returns Payment processing result
     */
    private async handlePaymentNotification(payload: WebhookPayload): Promise<{
        paymentId: string;
        status: string;
    }> {
        try {
            this.logger.info(
                {
                    action: payload.action,
                    paymentId: payload.data.id
                },
                'Handling payment notification'
            );

            const result = await this.paymentService.processPaymentNotification(payload.data.id);

            // Handle successful payments
            if (result.status === 'approved' && result.paymentId && result.status) {
                await this.handleSuccessfulPayment({
                    paymentId: result.paymentId,
                    status: result.status,
                    metadata: result.metadata
                });
            }

            return {
                paymentId: result.paymentId || '',
                status: result.status || 'unknown'
            };
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    paymentId: payload.data.id
                },
                'Failed to handle payment notification'
            );
            throw error;
        }
    }

    /**
     * Handles subscription notifications
     * @param payload - Webhook payload
     * @returns Subscription processing result
     */
    private async handleSubscriptionNotification(payload: WebhookPayload): Promise<{
        subscriptionId: string;
        status: string;
    }> {
        try {
            this.logger.info(
                {
                    action: payload.action,
                    subscriptionId: payload.data.id
                },
                'Handling subscription notification'
            );

            // TODO [916e0167-42cc-498b-ab5d-77100138fd26]: Implement subscription notification handling
            // This would involve fetching the subscription from Mercado Pago
            // and updating our local subscription record

            return {
                subscriptionId: payload.data.id,
                status: payload.action
            };
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    subscriptionId: payload.data.id
                },
                'Failed to handle subscription notification'
            );
            throw error;
        }
    }

    /**
     * Handles successful payment processing
     * @param paymentResult - Payment result
     */
    private async handleSuccessfulPayment(paymentResult: {
        paymentId: string;
        status: string;
        metadata?: Record<string, unknown>;
    }): Promise<void> {
        try {
            this.logger.info(
                {
                    paymentId: paymentResult.paymentId
                },
                'Handling successful payment'
            );

            // Get payment details
            // biome-ignore lint/suspicious/noExplicitAny: Temporary workaround for branded types
            const payment = await this.paymentService.getPayment(paymentResult.paymentId as any);
            if (!payment) {
                throw new Error(`Payment not found: ${paymentResult.paymentId}`);
            }

            // If this is a subscription payment, activate the subscription
            if (payment.type === 'subscription') {
                // TODO [a238264a-9940-4bb9-8a68-c2a0ef14589e]: Activate user features based on payment plan
                this.logger.info(
                    {
                        paymentId: paymentResult.paymentId,
                        userId: payment.userId,
                        paymentPlanId: payment.paymentPlanId
                    },
                    'Activating subscription features'
                );
            }

            // If this is a one-time payment, activate the features
            if (payment.type === 'one_time') {
                // TODO [1e22b515-1478-429c-b2ac-884a83bd25a6]: Activate user features based on payment plan
                this.logger.info(
                    {
                        paymentId: paymentResult.paymentId,
                        userId: payment.userId,
                        paymentPlanId: payment.paymentPlanId
                    },
                    'Activating one-time features'
                );
            }

            // TODO [fe08e3da-168d-4ef3-9ba6-32d0152ff9a5]: Send confirmation email to user
            // TODO [bab4f9df-3c9d-499a-9db3-a391a65d010e]: Update user permissions/features
            // TODO [d54c8796-77ac-43fb-a11e-9831c8732e4e]: Log analytics event
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    paymentResult
                },
                'Failed to handle successful payment'
            );
            // Don't throw here - we don't want to fail the webhook processing
            // The payment was successful, we just failed to activate features
        }
    }

    /**
     * Validates webhook payload structure
     * @param payload - Raw payload to validate
     * @returns True if payload is valid
     */
    validatePayload(payload: unknown): payload is WebhookPayload {
        if (!payload || typeof payload !== 'object') {
            return false;
        }

        const p = payload as Record<string, unknown>;

        return (
            typeof p.action === 'string' &&
            typeof p.api_version === 'string' &&
            typeof p.data === 'object' &&
            p.data !== null &&
            typeof (p.data as Record<string, unknown>).id === 'string' &&
            typeof p.date_created === 'string' &&
            typeof p.id === 'number' &&
            typeof p.live_mode === 'boolean' &&
            typeof p.type === 'string' &&
            typeof p.user_id === 'string'
        );
    }
}
