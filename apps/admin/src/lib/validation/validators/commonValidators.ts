import { fetchApi } from '@/lib/api/client';
import type { AsyncValidator } from '../hooks/useAsyncValidation';

/**
 * Configuration for API-based validators
 */
export type ApiValidatorConfig = {
    /** API endpoint for validation */
    readonly endpoint: string;
    /** HTTP method to use */
    readonly method?: 'GET' | 'POST';
    /** Additional headers */
    readonly headers?: Record<string, string>;
    /** Transform the value before sending */
    readonly transformValue?: (value: string) => unknown;
    /** Transform the response to get error message */
    readonly transformResponse?: (response: unknown) => string | null;
    /** Request timeout in milliseconds */
    readonly timeout?: number;
};

/**
 * Creates an API-based validator
 *
 * @example
 * ```tsx
 * const emailValidator = createApiValidator({
 *   endpoint: '/api/validate/email',
 *   method: 'POST',
 *   transformValue: (email) => ({ email }),
 *   transformResponse: (response) => response.isUnique ? null : 'Email already exists'
 * });
 * ```
 */
export const createApiValidator = (config: ApiValidatorConfig): AsyncValidator => {
    const {
        endpoint,
        method = 'POST',
        headers = {},
        transformValue = (value) => ({ value }),
        transformResponse = (response: unknown) =>
            (response as { error?: string | null })?.error || null,
        timeout = 5000
    } = config;

    return async (value: string): Promise<string | null> => {
        if (!value || value.trim() === '') {
            return null; // Don't validate empty values
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const requestBody = transformValue(value);

            const response = await fetchApi({
                path: endpoint,
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                ...(method === 'POST' && { body: requestBody }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            return transformResponse(response.data);
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                return 'Validation timeout. Please try again.';
            }

            throw error; // Let useAsyncValidation handle the error
        }
    };
};

/**
 * Email uniqueness validator
 *
 * @example
 * ```tsx
 * const { validate, state } = useAsyncValidation(
 *   createEmailUniquenessValidator('/api/validate/email')
 * );
 * ```
 */
export const createEmailUniquenessValidator = (endpoint: string): AsyncValidator => {
    return createApiValidator({
        endpoint,
        method: 'POST',
        transformValue: (email) => ({ email }),
        transformResponse: (response: unknown) => {
            const data = response as { isUnique?: boolean };
            if (data?.isUnique === false) {
                return 'This email is already registered';
            }
            return null;
        }
    });
};

/**
 * Username uniqueness validator
 *
 * @example
 * ```tsx
 * const { validate, state } = useAsyncValidation(
 *   createUsernameUniquenessValidator('/api/validate/username')
 * );
 * ```
 */
export const createUsernameUniquenessValidator = (endpoint: string): AsyncValidator => {
    return createApiValidator({
        endpoint,
        method: 'POST',
        transformValue: (username) => ({ username }),
        transformResponse: (response: unknown) => {
            const data = response as { isUnique?: boolean };
            if (data?.isUnique === false) {
                return 'This username is already taken';
            }
            return null;
        }
    });
};

/**
 * Slug uniqueness validator
 *
 * @example
 * ```tsx
 * const { validate, state } = useAsyncValidation(
 *   createSlugUniquenessValidator('/api/validate/slug', 'accommodations')
 * );
 * ```
 */
export const createSlugUniquenessValidator = (
    endpoint: string,
    entityType?: string
): AsyncValidator => {
    return createApiValidator({
        endpoint,
        method: 'POST',
        transformValue: (slug) => ({ slug, entityType }),
        transformResponse: (response: unknown) => {
            const data = response as { isUnique?: boolean };
            if (data?.isUnique === false) {
                return 'This slug is already in use';
            }
            return null;
        }
    });
};

/**
 * Phone number validator with format checking
 *
 * @example
 * ```tsx
 * const { validate, state } = useAsyncValidation(phoneValidator);
 * ```
 */
export const phoneValidator: AsyncValidator = async (phone: string): Promise<string | null> => {
    if (!phone || phone.trim() === '') {
        return null;
    }

    // Basic phone format validation
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    if (!phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))) {
        return 'Please enter a valid phone number';
    }

    // Simulate API call for phone validation
    return new Promise((resolve) => {
        setTimeout(() => {
            // Mock validation logic
            const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
            if (cleanPhone.length < 10) {
                resolve('Phone number is too short');
            } else if (cleanPhone.length > 15) {
                resolve('Phone number is too long');
            } else {
                resolve(null);
            }
        }, 500);
    });
};

/**
 * URL validator with reachability check
 *
 * @example
 * ```tsx
 * const { validate, state } = useAsyncValidation(urlValidator);
 * ```
 */
export const urlValidator: AsyncValidator = async (url: string): Promise<string | null> => {
    if (!url || url.trim() === '') {
        return null;
    }

    // Basic URL format validation
    try {
        new URL(url);
    } catch {
        return 'Please enter a valid URL';
    }

    // Optional: Check if URL is reachable (be careful with CORS)
    // This is a simplified example - in production you might want to do this server-side
    return new Promise((resolve) => {
        setTimeout(() => {
            // Mock reachability check
            if (url.includes('localhost') || url.includes('127.0.0.1')) {
                resolve('Local URLs are not allowed');
            } else {
                resolve(null);
            }
        }, 800);
    });
};

/**
 * Domain availability validator
 *
 * @example
 * ```tsx
 * const { validate, state } = useAsyncValidation(
 *   createDomainValidator('/api/validate/domain')
 * );
 * ```
 */
export const createDomainValidator = (endpoint: string): AsyncValidator => {
    return createApiValidator({
        endpoint,
        method: 'POST',
        transformValue: (domain) => ({ domain }),
        transformResponse: (response: unknown) => {
            const data = response as { isAvailable?: boolean; isValid?: boolean };
            if (data?.isAvailable === false) {
                return 'This domain is not available';
            }
            if (data?.isValid === false) {
                return 'Please enter a valid domain name';
            }
            return null;
        }
    });
};

/**
 * Tax ID validator (example for business forms)
 *
 * @example
 * ```tsx
 * const { validate, state } = useAsyncValidation(
 *   createTaxIdValidator('/api/validate/tax-id')
 * );
 * ```
 */
export const createTaxIdValidator = (endpoint: string): AsyncValidator => {
    return createApiValidator({
        endpoint,
        method: 'POST',
        transformValue: (taxId) => ({ taxId }),
        transformResponse: (response: unknown) => {
            const data = response as { isValid?: boolean; isRegistered?: boolean };
            if (data?.isValid === false) {
                return 'Invalid tax ID format';
            }
            if (data?.isRegistered === false) {
                return 'Tax ID not found in registry';
            }
            return null;
        }
    });
};

/**
 * Credit card validator (for payment forms)
 * Note: This is a simplified example - use proper payment processors in production
 *
 * @example
 * ```tsx
 * const { validate, state } = useAsyncValidation(creditCardValidator);
 * ```
 */
export const creditCardValidator: AsyncValidator = async (
    cardNumber: string
): Promise<string | null> => {
    if (!cardNumber || cardNumber.trim() === '') {
        return null;
    }

    const cleanNumber = cardNumber.replace(/\s/g, '');

    // Basic Luhn algorithm check
    const luhnCheck = (num: string): boolean => {
        let sum = 0;
        let isEven = false;

        for (let i = num.length - 1; i >= 0; i--) {
            let digit = Number.parseInt(num.charAt(i), 10);

            if (isEven) {
                digit *= 2;
                if (digit > 9) {
                    digit -= 9;
                }
            }

            sum += digit;
            isEven = !isEven;
        }

        return sum % 10 === 0;
    };

    return new Promise((resolve) => {
        setTimeout(() => {
            if (!/^\d{13,19}$/.test(cleanNumber)) {
                resolve('Invalid credit card number format');
                return;
            }
            if (!luhnCheck(cleanNumber)) {
                resolve('Invalid credit card number');
                return;
            }
            resolve(null);
        }, 600);
    });
};

/**
 * Predefined validator configurations for common use cases
 */
export const COMMON_VALIDATORS = {
    email: (endpoint: string) => createEmailUniquenessValidator(endpoint),
    username: (endpoint: string) => createUsernameUniquenessValidator(endpoint),
    slug: (endpoint: string, entityType?: string) =>
        createSlugUniquenessValidator(endpoint, entityType),
    phone: phoneValidator,
    url: urlValidator,
    domain: (endpoint: string) => createDomainValidator(endpoint),
    taxId: (endpoint: string) => createTaxIdValidator(endpoint),
    creditCard: creditCardValidator
} as const;
