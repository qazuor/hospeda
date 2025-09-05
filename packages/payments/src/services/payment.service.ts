import type { ILogger } from '@repo/logger';
import type {
    NewPaymentInputType,
    PaymentId,
    PaymentPlanId,
    PaymentPlanType,
    PaymentStatusEnum,
    PaymentType,
    PaymentTypeEnum,
    UpdatePaymentInputType,
    UserId
} from '@repo/types';
import type { MercadoPagoClient } from '../clients/mercado-pago.client.js';
import type { PaymentContext, PaymentPreference, PaymentResult } from '../types/index.js';
import { generateExternalReference, isPaymentSuccessful, isValidPrice } from '../utils/index.js';

/**
 * Payment repository interface for database operations
 */
export interface PaymentRepository {
    create(payment: NewPaymentInputType): Promise<PaymentType>;
    update(id: PaymentId, updates: UpdatePaymentInputType): Promise<PaymentType>;
    findById(id: PaymentId): Promise<PaymentType | null>;
    findByExternalReference(reference: string): Promise<PaymentType | null>;
    findByMercadoPagoId(mercadoPagoId: string): Promise<PaymentType | null>;
}

/**
 * Payment plan repository interface for database operations
 */
export interface PaymentPlanRepository {
    findById(id: PaymentPlanId): Promise<PaymentPlanType | null>;
    findBySlug(slug: string): Promise<PaymentPlanType | null>;
    findActive(): Promise<PaymentPlanType[]>;
}

/**
 * Service for handling payment operations
 */
export class PaymentService {
    private mercadoPagoClient: MercadoPagoClient;
    private paymentRepository: PaymentRepository;
    private paymentPlanRepository: PaymentPlanRepository;
    private logger: ILogger;

    /**
     * Creates a new PaymentService instance
     * @param mercadoPagoClient - Mercado Pago client
     * @param paymentRepository - Payment repository
     * @param paymentPlanRepository - Payment plan repository
     * @param logger - Logger instance
     */
    constructor(
        mercadoPagoClient: MercadoPagoClient,
        paymentRepository: PaymentRepository,
        paymentPlanRepository: PaymentPlanRepository,
        logger: ILogger
    ) {
        this.mercadoPagoClient = mercadoPagoClient;
        this.paymentRepository = paymentRepository;
        this.paymentPlanRepository = paymentPlanRepository;
        this.logger = logger;
    }

    /**
     * Creates a one-time payment preference
     * @param context - Payment context
     * @returns Payment preference for checkout
     */
    async createOneTimePayment(context: PaymentContext): Promise<PaymentPreference> {
        try {
            this.logger.info(
                {
                    userId: context.userId,
                    paymentPlanId: context.paymentPlanId
                },
                'Creating one-time payment'
            );

            // Get payment plan
            const paymentPlan = await this.paymentPlanRepository.findById(
                context.paymentPlanId as PaymentPlanId
            );
            if (!paymentPlan) {
                throw new Error(`Payment plan not found: ${context.paymentPlanId}`);
            }

            if (!paymentPlan.isActive) {
                throw new Error(`Payment plan is not active: ${context.paymentPlanId}`);
            }

            if (paymentPlan.type !== 'one_time') {
                throw new Error(
                    `Payment plan is not for one-time payments: ${context.paymentPlanId}`
                );
            }

            // Validate price
            if (!isValidPrice(paymentPlan.price)) {
                throw new Error(
                    `Invalid price for payment plan: ${paymentPlan.price} ${paymentPlan.currency}`
                );
            }

            // Generate external reference
            const externalReference = generateExternalReference('payment', context.userId);

            // Create payment record
            const payment = await this.paymentRepository.create({
                userId: context.userId as UserId,
                paymentPlanId: context.paymentPlanId as PaymentPlanId,
                type: 'one_time' as PaymentTypeEnum,
                status: 'pending' as PaymentStatusEnum,
                amount: paymentPlan.price,
                currency: paymentPlan.currency,
                externalReference,
                description: `Payment for ${paymentPlan.name}`,
                metadata: context.metadata
            });

            // Create Mercado Pago preference
            const preference = await this.mercadoPagoClient.createPreference({
                items: [
                    {
                        id: paymentPlan.slug,
                        title: paymentPlan.name,
                        description: paymentPlan.description || `Payment for ${paymentPlan.name}`,
                        quantity: 1,
                        unit_price: paymentPlan.price,
                        currency_id: paymentPlan.currency
                    }
                ],
                external_reference: externalReference,
                metadata: {
                    payment_id: payment.id,
                    user_id: context.userId,
                    payment_plan_id: context.paymentPlanId,
                    type: 'one_time'
                },
                back_urls: {
                    success: `${this.mercadoPagoClient.getConfig().webhookBaseUrl}/payment/success`,
                    failure: `${this.mercadoPagoClient.getConfig().webhookBaseUrl}/payment/failure`,
                    pending: `${this.mercadoPagoClient.getConfig().webhookBaseUrl}/payment/pending`
                },
                auto_return: 'approved'
            });

            // Update payment with preference ID
            await this.paymentRepository.update(payment.id, {
                mercadoPagoPreferenceId: preference.id
            });

            this.logger.info(
                {
                    paymentId: payment.id,
                    preferenceId: preference.id,
                    amount: paymentPlan.price,
                    currency: paymentPlan.currency
                },
                'One-time payment created successfully'
            );

            return {
                id: preference.id,
                init_point: preference.init_point,
                preferenceId: preference.id,
                sandboxInitPoint: preference.sandbox_init_point,
                initPoint: preference.init_point,
                paymentId: payment.id,
                externalReference
            };
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    context
                },
                'Failed to create one-time payment'
            );
            throw error;
        }
    }

    /**
     * Processes a payment notification from Mercado Pago
     * @param mercadoPagoPaymentId - Mercado Pago payment ID
     * @returns Payment processing result
     */
    async processPaymentNotification(mercadoPagoPaymentId: string): Promise<PaymentResult> {
        try {
            this.logger.info({ mercadoPagoPaymentId }, 'Processing payment notification');

            // Get payment from Mercado Pago
            const mpPayment = await this.mercadoPagoClient.getPayment(mercadoPagoPaymentId);

            // Find payment by external reference or Mercado Pago ID
            let payment = await this.paymentRepository.findByMercadoPagoId(mercadoPagoPaymentId);

            if (!payment && mpPayment.external_reference) {
                payment = await this.paymentRepository.findByExternalReference(
                    mpPayment.external_reference
                );
            }

            if (!payment) {
                throw new Error(`Payment not found for Mercado Pago ID: ${mercadoPagoPaymentId}`);
            }

            // Update payment with Mercado Pago data
            const updatedPayment = await this.paymentRepository.update(payment.id, {
                status: mpPayment.status,
                mercadoPagoPaymentId: mercadoPagoPaymentId,
                paymentMethod: mpPayment.payment_type_id,
                processedAt: mpPayment.date_approved
                    ? new Date(mpPayment.date_approved)
                    : new Date(),
                failureReason: mpPayment.status_detail,
                mercadoPagoResponse: mpPayment as unknown as Record<string, unknown>
            });

            this.logger.info(
                {
                    paymentId: payment.id,
                    status: mpPayment.status,
                    amount: mpPayment.transaction_amount
                },
                'Payment notification processed successfully'
            );

            return {
                success: true,
                paymentId: updatedPayment.id,
                status: updatedPayment.status,
                amount: updatedPayment.amount,
                currency: updatedPayment.currency,
                mercadoPagoPaymentId,
                externalReference: updatedPayment.externalReference,
                metadata: updatedPayment.metadata
            };
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    mercadoPagoPaymentId
                },
                'Failed to process payment notification'
            );
            throw error;
        }
    }

    /**
     * Gets payment by ID
     * @param paymentId - Payment ID
     * @returns Payment or null if not found
     */
    async getPayment(paymentId: PaymentId): Promise<PaymentType | null> {
        return this.paymentRepository.findById(paymentId);
    }

    /**
     * Checks if a payment is successful
     * @param paymentId - Payment ID
     * @returns True if payment is successful
     */
    async isPaymentSuccessful(paymentId: PaymentId): Promise<boolean> {
        const payment = await this.paymentRepository.findById(paymentId);
        return payment ? isPaymentSuccessful(payment.status) : false;
    }

    /**
     * Gets all active payment plans
     * @returns List of active payment plans
     */
    async getActivePaymentPlans(): Promise<PaymentPlanType[]> {
        return this.paymentPlanRepository.findActive();
    }

    /**
     * Gets payment plan by slug
     * @param slug - Payment plan slug
     * @returns Payment plan or null if not found
     */
    async getPaymentPlanBySlug(slug: string): Promise<PaymentPlanType | null> {
        return this.paymentPlanRepository.findBySlug(slug);
    }
}
