/**
 * Billing API Client
 *
 * Provides type-safe helper functions for billing operations that go through
 * the Hospeda API. Used by client-side components to interact with billing
 * endpoints without directly using qzpay-react hooks.
 *
 * @module lib/billing-api-client
 */

/**
 * API base URL from environment
 */
const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:3001/api/v1';

/**
 * Checkout session response
 */
export interface CheckoutSessionResponse {
    checkoutUrl: string;
    sessionId: string;
}

/**
 * Payment method response
 */
export interface PaymentMethod {
    id: string;
    type: string;
    last4?: string;
    brand?: string;
    isDefault: boolean;
}

/**
 * Promo code discount information
 */
export interface PromoCodeDiscount {
    type: 'percentage' | 'fixed';
    value: number;
}

/**
 * Promo code validation response
 */
export interface PromoCodeValidationResponse {
    valid: boolean;
    discount?: PromoCodeDiscount;
    message?: string;
}

/**
 * API error response structure
 */
interface ApiErrorResponse {
    error: {
        message: string;
        code?: string;
    };
}

/**
 * API success response structure
 */
interface ApiSuccessResponse<T> {
    data: T;
}

/**
 * Generic fetch wrapper with error handling
 *
 * @param path - API endpoint path (relative to /billing)
 * @param options - Fetch options
 * @returns Parsed response data
 * @throws Error if response is not OK
 */
async function billingFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE}/billing${path}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        credentials: 'include'
    });

    if (!response.ok) {
        let errorMessage = 'API request failed';

        try {
            const errorData = (await response.json()) as ApiErrorResponse;
            errorMessage = errorData.error?.message || errorMessage;
        } catch {
            // If JSON parsing fails, use default message
        }

        throw new Error(errorMessage);
    }

    const result = (await response.json()) as ApiSuccessResponse<T>;
    return result.data;
}

/**
 * Create a checkout session for a plan
 *
 * @param params - Checkout session parameters
 * @returns Checkout URL and session ID
 * @throws Error if checkout session creation fails
 *
 * @example
 * ```typescript
 * const { checkoutUrl } = await createCheckoutSession({
 *   planSlug: 'pro-plan',
 *   interval: 'month',
 *   promoCode: 'SAVE20'
 * });
 * window.location.href = checkoutUrl;
 * ```
 */
export async function createCheckoutSession(params: {
    planSlug: string;
    interval: 'month' | 'year';
    promoCode?: string;
    successUrl?: string;
    cancelUrl?: string;
}): Promise<CheckoutSessionResponse> {
    const body = {
        planSlug: params.planSlug,
        interval: params.interval,
        promoCode: params.promoCode,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl
    };

    return billingFetch<CheckoutSessionResponse>('/checkout', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

/**
 * Create a checkout session for an addon
 *
 * @param params - Addon checkout parameters
 * @returns Checkout URL and session ID
 * @throws Error if checkout session creation fails
 *
 * @example
 * ```typescript
 * const { checkoutUrl } = await createAddonCheckoutSession({
 *   addonSlug: 'extra-listings',
 *   quantity: 5,
 *   promoCode: 'ADDON10'
 * });
 * window.location.href = checkoutUrl;
 * ```
 */
export async function createAddonCheckoutSession(params: {
    addonSlug: string;
    quantity?: number;
    promoCode?: string;
    successUrl?: string;
    cancelUrl?: string;
}): Promise<CheckoutSessionResponse> {
    const body = {
        promoCode: params.promoCode,
        quantity: params.quantity,
        successUrl: params.successUrl,
        cancelUrl: params.cancelUrl
    };

    return billingFetch<CheckoutSessionResponse>(`/addons/${params.addonSlug}/purchase`, {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

/**
 * Validate a promo code
 *
 * @param params - Promo code validation parameters
 * @returns Validation result with discount information
 *
 * @example
 * ```typescript
 * const result = await validatePromoCode({
 *   code: 'SAVE20',
 *   planSlug: 'pro-plan'
 * });
 *
 * if (result.valid) {
 *   console.log(`Discount: ${result.discount?.value}${result.discount?.type === 'percentage' ? '%' : ''}`);
 * } else {
 *   console.log(result.message);
 * }
 * ```
 */
export async function validatePromoCode(params: {
    code: string;
    planSlug?: string;
}): Promise<PromoCodeValidationResponse> {
    const body = {
        code: params.code,
        planId: params.planSlug
    };

    return billingFetch<PromoCodeValidationResponse>('/promo-codes/validate', {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

/**
 * Get available payment methods for the current user
 *
 * @returns Array of payment methods
 * @throws Error if payment methods cannot be retrieved
 *
 * @example
 * ```typescript
 * const methods = await getPaymentMethods();
 * const defaultMethod = methods.find(m => m.isDefault);
 * ```
 */
export async function getPaymentMethods(): Promise<PaymentMethod[]> {
    return billingFetch<PaymentMethod[]>('/payment-methods');
}

/**
 * Update the default payment method
 *
 * @param paymentMethodId - ID of the payment method to set as default
 * @throws Error if payment method update fails
 *
 * @example
 * ```typescript
 * await updateDefaultPaymentMethod('pm_123abc');
 * ```
 */
export async function updateDefaultPaymentMethod(paymentMethodId: string): Promise<void> {
    await billingFetch<void>(`/payment-methods/${paymentMethodId}/set-default`, {
        method: 'POST'
    });
}
