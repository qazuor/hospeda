import type { ILogger } from '@repo/logger';
import type { PaymentMethodEnum, PaymentStatusEnum, PriceCurrencyEnum } from '@repo/schemas';
import MercadoPago, { Payment, Preference } from 'mercadopago';
import type { MercadoPagoConfig } from '../config/mercado-pago.config.js';

/**
 * Mercado Pago preference creation input
 */
export interface CreatePreferenceInput {
    /** Items to be paid */
    items: Array<{
        id: string;
        title: string;
        description?: string;
        quantity: number;
        unit_price: number;
        currency_id: PriceCurrencyEnum;
    }>;
    /** Payer information */
    payer?: {
        name?: string;
        surname?: string;
        email?: string;
        phone?: {
            area_code?: string;
            number?: string;
        };
        identification?: {
            type?: string;
            number?: string;
        };
        address?: {
            street_name?: string;
            street_number?: string;
            zip_code?: string;
        };
    };
    /** Payment methods configuration */
    payment_methods?: {
        excluded_payment_methods?: Array<{ id: string }>;
        excluded_payment_types?: Array<{ id: string }>;
        installments?: number;
    };
    /** URLs for redirects */
    back_urls?: {
        success?: string;
        failure?: string;
        pending?: string;
    };
    /** Auto return preference */
    auto_return?: 'approved' | 'all';
    /** External reference */
    external_reference?: string;
    /** Notification URL */
    notification_url?: string;
    /** Additional metadata */
    metadata?: Record<string, string>;
}

/**
 * Mercado Pago preference response
 */
export interface PreferenceResponse {
    id: string;
    init_point: string;
    sandbox_init_point: string;
    date_created: string;
    items: Array<{
        id: string;
        title: string;
        description?: string;
        quantity: number;
        unit_price: number;
        currency_id: string;
    }>;
    payer?: unknown;
    back_urls?: unknown;
    auto_return?: string;
    payment_methods?: unknown;
    notification_url?: string;
    external_reference?: string;
    metadata?: Record<string, string>;
}

/**
 * Mercado Pago payment response
 */
export interface PaymentResponse {
    id: number;
    status: PaymentStatusEnum;
    status_detail: string;
    operation_type: string;
    date_created: string;
    date_approved?: string;
    date_last_updated: string;
    money_release_date?: string;
    payment_method_id: string;
    payment_type_id: PaymentMethodEnum;
    currency_id: PriceCurrencyEnum;
    transaction_amount: number;
    transaction_amount_refunded: number;
    coupon_amount: number;
    differential_pricing_id?: number;
    deduction_schema?: unknown;
    transaction_details: {
        net_received_amount: number;
        total_paid_amount: number;
        overpaid_amount: number;
        external_resource_url?: string;
        installment_amount?: number;
        financial_institution?: string;
        payment_method_reference_id?: string;
        payable_deferral_period?: string;
        acquirer_reference?: string;
    };
    fee_details: Array<{
        type: string;
        amount: number;
        fee_payer: string;
    }>;
    charges_details: Array<{
        id: string;
        name: string;
        type: string;
        accounts: {
            from: string;
            to: string;
        };
        client_id: number;
        date_created: string;
        last_updated: string;
    }>;
    captured: boolean;
    binary_mode: boolean;
    live_mode: boolean;
    order?: unknown;
    external_reference?: string;
    description: string;
    metadata?: Record<string, unknown>;
    payer: {
        type?: string;
        id?: string;
        email?: string;
        identification?: {
            type?: string;
            number?: string;
        };
        phone?: {
            area_code?: string;
            number?: string;
            extension?: string;
        };
        first_name?: string;
        last_name?: string;
        entity_type?: string;
    };
    additional_info?: {
        authentication_code?: string;
        available_balance?: number;
        nsu_processadora?: string;
    };
    card?: unknown;
    statement_descriptor?: string;
    installments: number;
    pos_id?: string;
    store_id?: string;
    integrator_id?: string;
    platform_id?: string;
    corporation_id?: string;
    collector_id: number;
    sponsor_id?: number;
    application_fee?: number;
    processing_mode: string;
    merchant_account_id?: string;
    acquirer?: string;
    merchant_number?: string;
}

/**
 * Mercado Pago client for handling payments and preferences
 */
export class MercadoPagoClient {
    private client: MercadoPago;
    private logger: ILogger;
    private config: MercadoPagoConfig;

    /**
     * Creates a new Mercado Pago client instance
     * @param config - Mercado Pago configuration
     * @param logger - Logger instance
     */
    constructor(config: MercadoPagoConfig, logger: ILogger) {
        this.config = config;
        this.logger = logger;

        this.client = new MercadoPago({
            accessToken: config.accessToken,
            options: {
                timeout: 30000,
                idempotencyKey: undefined
            }
        });

        this.logger.info(
            {
                environment: config.environment,
                currency: config.defaultCurrency
            },
            'Mercado Pago client initialized'
        );
    }

    /**
     * Creates a payment preference
     * @param input - Preference creation input
     * @returns Promise with preference response
     */
    async createPreference(input: CreatePreferenceInput): Promise<PreferenceResponse> {
        try {
            this.logger.info(
                {
                    items: input.items.length,
                    externalReference: input.external_reference
                },
                'Creating Mercado Pago preference'
            );

            const preference = new Preference(this.client);
            const response = await preference.create({
                body: {
                    ...input,
                    notification_url: input.notification_url || this.config.webhookBaseUrl
                }
            });

            this.logger.info(
                {
                    preferenceId: response.id,
                    initPoint: response.init_point
                },
                'Mercado Pago preference created successfully'
            );

            return response as PreferenceResponse;
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    input
                },
                'Failed to create Mercado Pago preference'
            );
            throw new Error(
                `Failed to create payment preference: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Gets payment information by ID
     * @param paymentId - Mercado Pago payment ID
     * @returns Promise with payment response
     */
    async getPayment(paymentId: string): Promise<PaymentResponse> {
        try {
            this.logger.info({ paymentId }, 'Fetching Mercado Pago payment');

            const payment = new Payment(this.client);
            const response = await payment.get({ id: paymentId });

            this.logger.info(
                {
                    paymentId,
                    status: response.status,
                    amount: response.transaction_amount
                },
                'Mercado Pago payment fetched successfully'
            );

            return response as PaymentResponse;
        } catch (error) {
            this.logger.error(
                {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    paymentId
                },
                'Failed to fetch Mercado Pago payment'
            );
            throw new Error(
                `Failed to fetch payment: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Validates webhook signature
     * @param payload - Webhook payload
     * @param signature - Webhook signature
     * @returns True if signature is valid
     */
    validateWebhookSignature(payload: string, signature: string): boolean {
        if (!this.config.webhookSecret) {
            this.logger.warn('Webhook secret not configured, skipping signature validation');
            return true;
        }

        // TODO: Implement proper signature validation based on Mercado Pago documentation
        // This is a placeholder implementation
        this.logger.info(
            {
                hasSignature: !!signature,
                payloadLength: payload.length
            },
            'Validating webhook signature'
        );

        return true;
    }

    /**
     * Gets the client configuration
     * @returns Mercado Pago configuration (without sensitive data)
     */
    getConfig(): Omit<MercadoPagoConfig, 'accessToken' | 'webhookSecret'> {
        const { accessToken, webhookSecret, ...safeConfig } = this.config;
        return safeConfig;
    }
}
