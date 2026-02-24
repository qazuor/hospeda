import type { ValidationTriggerEnum } from '@/components/entity-form/enums/form-config.enums';
import { fetchApi } from '@/lib/api/client';
import { adminLogger } from '@/utils/logger';

/**
 * Configuration for async validation
 */
export type AsyncValidationConfig = {
    validator: AsyncValidatorFn;
    trigger: ValidationTriggerEnum;
    debounceMs?: number;
    errorMessage?: string;
};

/**
 * Async validator function type
 */
export type AsyncValidatorFn = (value: unknown, context?: ValidationContext) => Promise<boolean>;

/**
 * Context provided to async validators
 */
export type ValidationContext = {
    entityId?: string;
    entityType?: string;
    fieldPath?: string;
    formData?: Record<string, unknown>;
};

/**
 * Generic unique validator configuration.
 *
 * @remarks
 * The `endpoint` field is REQUIRED. There are no default validation endpoints in the API.
 * Callers must provide the full path to a real API endpoint, e.g.:
 * `/api/v1/admin/destinations/validate/unique`
 *
 * The endpoint must accept query params: `field`, `value`, and optionally `excludeId`.
 * It must return `{ isUnique: boolean }`.
 */
export type UniqueValidatorConfig = {
    entityType: string;
    field: string;
    /** Full API path to the unique validation endpoint. Required - no default exists. */
    endpoint: string;
    excludeId?: string;
};

/**
 * Generic exists validator configuration.
 *
 * @remarks
 * The `endpoint` field is REQUIRED. There are no default `/exists` endpoints in the API.
 * Callers must provide the full path template where the entity ID will be appended, e.g.:
 * `/api/v1/admin/destinations` (the validator will append `/${value}/exists`)
 *
 * The endpoint must return `{ exists: boolean }`.
 */
export type ExistsValidatorConfig = {
    entityType: string;
    /** Full API path prefix for the exists endpoint. Required - no default exists. */
    endpoint: string;
};

/**
 * Generic relationship validator configuration.
 *
 * @remarks
 * The `endpoint` field is REQUIRED. There are no default `/accessible` endpoints in the API.
 * Callers must provide the full path template where the entity ID will be appended, e.g.:
 * `/api/v1/admin/users` (the validator will append `/${value}/accessible`)
 *
 * The endpoint must accept a POST body of `{ requiredPermissions: string[] }` and
 * return `{ accessible: boolean }`.
 */
export type RelationshipValidatorConfig = {
    entityType: string;
    /** Full API path prefix for the accessible endpoint. Required - no default exists. */
    endpoint: string;
    requiredPermissions?: string[];
};

/**
 * Configuration for server-side email validation.
 * Only used when `checkDomain` is true.
 *
 * @remarks
 * The `endpoint` field is REQUIRED when `checkDomain` is true.
 * There is no default `/api/v1/admin/validation/email` endpoint in the API.
 */
export type EmailValidatorServerConfig = {
    /** Full API path to the email validation endpoint. Required when checkDomain is true. */
    endpoint: string;
    checkDomain: true;
};

/**
 * Configuration for client-side only email validation.
 * No server request is made.
 */
export type EmailValidatorClientConfig = {
    endpoint?: never;
    checkDomain?: false;
};

export type EmailValidatorConfig = EmailValidatorServerConfig | EmailValidatorClientConfig;

/**
 * Configuration for server-side URL reachability validation.
 * Only used when `checkReachability` is true.
 *
 * @remarks
 * The `endpoint` field is REQUIRED when `checkReachability` is true.
 * There is no default `/api/v1/admin/validation/url` endpoint in the API.
 */
export type UrlValidatorServerConfig = {
    /** Full API path to the URL validation endpoint. Required when checkReachability is true. */
    endpoint: string;
    checkReachability: true;
    allowedProtocols?: string[];
};

/**
 * Configuration for client-side only URL validation.
 * No server request is made.
 */
export type UrlValidatorClientConfig = {
    endpoint?: never;
    checkReachability?: false;
    allowedProtocols?: string[];
};

export type UrlValidatorConfig = UrlValidatorServerConfig | UrlValidatorClientConfig;

/**
 * Generic unique validator.
 * Validates that a field value is unique across all entities of a type.
 *
 * @remarks
 * Requires a real API endpoint via `config.endpoint`. No default endpoint exists.
 * The endpoint must accept query params `field`, `value`, and optionally `excludeId`,
 * and return `{ isUnique: boolean }`.
 *
 * @param config - Configuration including the required `endpoint`
 * @returns Async validator function that resolves to `true` if the value is unique
 *
 * @example
 * ```ts
 * createUniqueValidator({
 *   entityType: 'destination',
 *   field: 'slug',
 *   endpoint: '/api/v1/admin/destinations/validate/unique',
 * });
 * ```
 */
export const createUniqueValidator = (config: UniqueValidatorConfig): AsyncValidatorFn => {
    return async (value: unknown, context?: ValidationContext) => {
        if (!value || typeof value !== 'string') return true;

        const params = new URLSearchParams({
            field: config.field,
            value: value,
            ...(config.excludeId && { excludeId: config.excludeId }),
            ...(context?.entityId && { excludeId: context.entityId })
        });

        try {
            const response = await fetchApi({ path: `${config.endpoint}?${params}` });
            return (response.data as { isUnique: boolean }).isUnique;
        } catch (error) {
            adminLogger.error('Unique validation error', error);
            return false;
        }
    };
};

/**
 * Generic exists validator.
 * Validates that an entity with the given ID exists.
 *
 * @remarks
 * Requires a real API endpoint via `config.endpoint`. No default endpoint exists.
 * The validator appends `/${value}/exists` to the provided endpoint path.
 * The endpoint must return `{ exists: boolean }`.
 *
 * @param config - Configuration including the required `endpoint`
 * @returns Async validator function that resolves to `true` if the entity exists
 *
 * @example
 * ```ts
 * createExistsValidator({
 *   entityType: 'destination',
 *   endpoint: '/api/v1/admin/destinations',
 *   // Will call GET /api/v1/admin/destinations/${value}/exists
 * });
 * ```
 */
export const createExistsValidator = (config: ExistsValidatorConfig): AsyncValidatorFn => {
    return async (value: unknown) => {
        if (!value || typeof value !== 'string') return true;

        try {
            const response = await fetchApi({ path: `${config.endpoint}/${value}/exists` });
            return (response.data as { exists: boolean }).exists;
        } catch (error) {
            adminLogger.error('Exists validation error', error);
            return false;
        }
    };
};

/**
 * Generic relationship validator.
 * Checks if related entity exists and is accessible with required permissions.
 *
 * @remarks
 * Requires a real API endpoint via `config.endpoint`. No default endpoint exists.
 * The validator appends `/${value}/accessible` to the provided endpoint path.
 * The endpoint must accept POST `{ requiredPermissions: string[] }` and return
 * `{ accessible: boolean }`.
 *
 * @param config - Configuration including the required `endpoint`
 * @returns Async validator function that resolves to `true` if the entity is accessible
 *
 * @example
 * ```ts
 * createRelationshipValidator({
 *   entityType: 'user',
 *   endpoint: '/api/v1/admin/users',
 *   requiredPermissions: ['user.view'],
 *   // Will call POST /api/v1/admin/users/${value}/accessible
 * });
 * ```
 */
export const createRelationshipValidator = (
    config: RelationshipValidatorConfig
): AsyncValidatorFn => {
    return async (value: unknown, _context?: ValidationContext) => {
        if (!value || typeof value !== 'string') return true;

        try {
            const response = await fetchApi({
                path: `${config.endpoint}/${value}/accessible`,
                method: 'POST',
                body: {
                    requiredPermissions: config.requiredPermissions || []
                }
            });
            return (response.data as { accessible: boolean }).accessible;
        } catch (error) {
            adminLogger.error('Relationship validation error', error);
            return false;
        }
    };
};

/**
 * Email format validator (async version for optional server-side domain validation).
 *
 * @remarks
 * When `checkDomain` is false (default), only client-side regex validation is performed.
 * No API call is made, so no endpoint is needed.
 *
 * When `checkDomain` is true, a server-side request is made. In this case `endpoint`
 * is REQUIRED. There is no default `/api/v1/admin/validation/email` endpoint in the API.
 * The endpoint must accept POST `{ email: string }` and return `{ isValid: boolean }`.
 *
 * @param config - Optional configuration; `endpoint` required only when `checkDomain` is true
 * @returns Async validator function that resolves to `true` if the email is valid
 */
export const createEmailValidator = (config?: EmailValidatorConfig): AsyncValidatorFn => {
    return async (value: unknown) => {
        if (!value || typeof value !== 'string') return true;

        // Basic email format check first
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return false;

        // If domain checking is enabled, validate with server
        if (config?.checkDomain) {
            try {
                const response = await fetchApi({
                    path: config.endpoint,
                    method: 'POST',
                    body: { email: value }
                });
                return (response.data as { isValid: boolean }).isValid;
            } catch (error) {
                adminLogger.error('Email validation error', error);
                return false;
            }
        }

        return true;
    };
};

/**
 * URL validator (async version for optional server-side reachability check).
 *
 * @remarks
 * When `checkReachability` is false (default), only client-side URL parsing is performed.
 * No API call is made, so no endpoint is needed.
 *
 * When `checkReachability` is true, a server-side request is made. In this case `endpoint`
 * is REQUIRED. There is no default `/api/v1/admin/validation/url` endpoint in the API.
 * The endpoint must accept POST `{ url: string }` and return `{ isReachable: boolean }`.
 *
 * @param config - Optional configuration; `endpoint` required only when `checkReachability` is true
 * @returns Async validator function that resolves to `true` if the URL is valid
 */
export const createUrlValidator = (config?: UrlValidatorConfig): AsyncValidatorFn => {
    return async (value: unknown) => {
        if (!value || typeof value !== 'string') return true;

        try {
            const url = new URL(value);

            // Check allowed protocols
            if (config?.allowedProtocols && !config.allowedProtocols.includes(url.protocol)) {
                return false;
            }

            // If reachability checking is enabled, validate with server
            if (config?.checkReachability) {
                try {
                    const response = await fetchApi({
                        path: config.endpoint,
                        method: 'POST',
                        body: { url: value }
                    });
                    return (response.data as { isReachable: boolean }).isReachable;
                } catch (error) {
                    adminLogger.error('URL validation error', error);
                    return false;
                }
            }

            return true;
        } catch {
            return false;
        }
    };
};

/**
 * Predefined common async validators.
 *
 * @remarks
 * Validators that require server-side checks (`uniqueSlug`, `uniqueEmail`, `uniqueName`,
 * `destinationExists`, `userExists`, `eventExists`, `postExists`, `featureExists`,
 * `amenityExists`, `tagExists`, `ownerAccessible`) are NOT included here because they
 * depend on real API endpoints that must be provided by the caller.
 *
 * Use `createUniqueValidator`, `createExistsValidator`, or `createRelationshipValidator`
 * directly, providing the `endpoint` for the specific entity route.
 *
 * Only validators that can run fully client-side are included.
 */
export const commonAsyncValidators = {
    /**
     * Validates email format (client-side only, no server request).
     */
    validEmail: () => createEmailValidator(),

    /**
     * Validates URL format and optionally checks allowed protocols (client-side only).
     *
     * @param allowedProtocols - Protocols to allow (default: http and https)
     */
    validUrl: (allowedProtocols = ['http:', 'https:']) => createUrlValidator({ allowedProtocols })
};

/**
 * Utility to create a debounced async validator.
 *
 * @param validator - The async validator function
 * @param debounceMs - Debounce delay in milliseconds
 * @returns Debounced validator function
 */
export const createDebouncedValidator = (
    validator: AsyncValidatorFn,
    debounceMs = 300
): AsyncValidatorFn => {
    let timeoutId: NodeJS.Timeout;

    return (value: unknown, context?: ValidationContext) => {
        return new Promise((resolve) => {
            clearTimeout(timeoutId);

            timeoutId = setTimeout(async () => {
                try {
                    const result = await validator(value, context);
                    resolve(result);
                } catch (error) {
                    adminLogger.error('Debounced validation error', error);
                    resolve(false);
                }
            }, debounceMs);
        });
    };
};

/**
 * Utility to combine multiple async validators with AND logic.
 *
 * @param validators - Array of async validator functions
 * @returns Combined validator function
 */
export const combineAsyncValidators = (validators: AsyncValidatorFn[]): AsyncValidatorFn => {
    return async (value: unknown, context?: ValidationContext) => {
        for (const validator of validators) {
            const result = await validator(value, context);
            if (!result) return false;
        }
        return true;
    };
};

/**
 * Utility to combine multiple async validators with OR logic.
 *
 * @param validators - Array of async validator functions
 * @returns Combined validator function
 */
export const combineAsyncValidatorsOr = (validators: AsyncValidatorFn[]): AsyncValidatorFn => {
    return async (value: unknown, context?: ValidationContext) => {
        for (const validator of validators) {
            const result = await validator(value, context);
            if (result) return true;
        }
        return false;
    };
};
