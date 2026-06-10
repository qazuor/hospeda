/**
 * Sensitive-data redaction for logger output.
 *
 * Leaf module with no internal dependencies so it can be shared by the pretty
 * formatter, the NDJSON output path, and the structured log entry builder
 * without creating import cycles.
 *
 * @module logger/redact
 */

/**
 * Patterns and keys for sensitive data that should be redacted from logs
 * @internal
 */
const SENSITIVE_KEYS = new Set([
    // Authentication & Credentials
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'apikey',
    'api_key',
    'apiKey',
    'authorization',
    'auth',
    'bearer',
    'credential',
    'credentials',
    'private_key',
    'privateKey',
    'secret_key',
    'secretKey',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'idToken',
    'id_token',
    'sessionToken',
    'session_token',
    'jwt',
    'cookie',
    'session',
    // Personal Identifiable Information (PII)
    'ssn',
    'socialSecurityNumber',
    'social_security_number',
    'dni',
    'cuil',
    'cuit',
    'passport',
    'driverLicense',
    'driver_license',
    // Financial Data
    'creditCard',
    'credit_card',
    'cardNumber',
    'card_number',
    'cvv',
    'cvc',
    'ccv',
    'pin',
    'bankAccount',
    'bank_account',
    'accountNumber',
    'account_number',
    'routingNumber',
    'routing_number',
    // Contact Information (PII)
    'phone',
    'phoneNumber',
    'phone_number',
    'mobile',
    'mobileNumber',
    'mobile_number',
    'cellphone',
    'email',
    'emailAddress',
    'email_address',
    // Location Data (PII)
    'address',
    'streetAddress',
    'street_address',
    'homeAddress',
    'home_address',
    'ipAddress',
    'ip_address',
    'ip',
    'geolocation',
    'coordinates',
    'lat',
    'lng',
    'latitude',
    'longitude'
]);

/**
 * Patterns for sensitive data values
 * @internal
 */
const SENSITIVE_PATTERNS = [
    // JWT tokens (xxxxx.xxxxx.xxxxx)
    /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    // Bearer tokens
    /Bearer\s+[a-zA-Z0-9_-]+/gi,
    // Credit card numbers (basic pattern - 13-19 digits with optional separators)
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,7}\b/g,
    // SSN pattern (US)
    /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g,
    // Email addresses. The domain is matched as label(.label)+ where a label
    // never contains a dot, so there is no overlap between the label class and
    // the `.` separator. This is linear; the previous `[A-Za-z0-9.-]+\.` form
    // backtracked polynomially on inputs like `a@a.a.a...` (CodeQL js/polynomial-redos).
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+\b/g,
    // Phone numbers (various formats)
    /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    // Argentine phone numbers
    /\b(?:\+?54[-.\s]?)?(?:9[-.\s]?)?(?:11|[2-9]\d{2,3})[-.\s]?\d{3,4}[-.\s]?\d{4}\b/g,
    // Argentine CUIT/CUIL (XX-XXXXXXXX-X)
    /\b\d{2}[-]?\d{8}[-]?\d{1}\b/g,
    // IPv4 addresses
    /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    // IPv6 addresses (simplified pattern)
    /\b(?:[a-fA-F0-9]{1,4}:){7}[a-fA-F0-9]{1,4}\b/g,
    // API keys (common formats with prefixes - require specific prefixes to avoid false positives)
    /\b(?:sk_|pk_|api_|key_)[a-zA-Z0-9]{20,}\b/g
];

/**
 * Redacts sensitive data from a value
 * @param value - The value to redact
 * @param key - Optional key name for context
 * @returns The redacted value
 */
export function redactSensitiveData(value: unknown, key?: string): unknown {
    // Check if the key itself indicates sensitive data
    if (key && SENSITIVE_KEYS.has(key.toLowerCase())) {
        return '[REDACTED]';
    }

    // Handle strings - check for sensitive patterns
    if (typeof value === 'string') {
        let redacted = value;
        for (const pattern of SENSITIVE_PATTERNS) {
            // Reset lastIndex for global patterns
            pattern.lastIndex = 0;
            redacted = redacted.replace(pattern, '[REDACTED]');
        }
        return redacted;
    }

    // Handle Error instances explicitly — their fields (name, message, stack,
    // cause) are non-enumerable, so they would survive the generic object
    // branch below as `{}` after JSON.stringify, hiding the actual failure.
    // Extract them by hand so downstream serialization shows the useful info.
    if (value instanceof Error) {
        const errorObj: Record<string, unknown> = {
            name: value.name,
            message: redactSensitiveData(value.message) as string
        };
        if (value.stack) {
            errorObj.stack = redactSensitiveData(value.stack) as string;
        }
        if ('cause' in value && value.cause !== undefined) {
            errorObj.cause = redactSensitiveData(value.cause);
        }
        return errorObj;
    }

    // Handle arrays
    if (Array.isArray(value)) {
        return value.map((item) => redactSensitiveData(item));
    }

    // Handle objects (recursively)
    if (value !== null && typeof value === 'object') {
        const redacted: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value)) {
            redacted[k] = redactSensitiveData(v, k);
        }
        return redacted;
    }

    return value;
}
