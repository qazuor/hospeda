import type { ValidationTriggerEnum } from '@/components/entity-form/enums/form-config.enums';
import { fetchApi } from '@/lib/api/client';

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
 * Generic unique validator configuration
 */
export type UniqueValidatorConfig = {
    entityType: string;
    field: string;
    endpoint?: string;
    excludeId?: string;
};

/**
 * Generic exists validator configuration
 */
export type ExistsValidatorConfig = {
    entityType: string;
    endpoint?: string;
};

/**
 * Generic relationship validator configuration
 */
export type RelationshipValidatorConfig = {
    entityType: string;
    endpoint?: string;
    requiredPermissions?: string[];
};

/**
 * Generic unique validator
 * Validates that a field value is unique across all entities of a type
 *
 * @param config - Configuration for the unique validator
 * @returns Async validator function
 */
export const createUniqueValidator = (config: UniqueValidatorConfig): AsyncValidatorFn => {
    return async (value: unknown, context?: ValidationContext) => {
        if (!value || typeof value !== 'string') return true;

        const endpoint = config.endpoint || `/api/${config.entityType}/validate/unique`;

        const params = new URLSearchParams({
            field: config.field,
            value: value,
            ...(config.excludeId && { excludeId: config.excludeId }),
            ...(context?.entityId && { excludeId: context.entityId })
        });

        try {
            const response = await fetchApi({ path: `${endpoint}?${params}` });
            return (response.data as { isUnique: boolean }).isUnique;
        } catch (error) {
            console.error('Unique validation error:', error);
            return false;
        }
    };
};

/**
 * Generic exists validator
 * Validates that an entity with the given ID exists
 *
 * @param config - Configuration for the exists validator
 * @returns Async validator function
 */
export const createExistsValidator = (config: ExistsValidatorConfig): AsyncValidatorFn => {
    return async (value: unknown) => {
        if (!value || typeof value !== 'string') return true;

        const endpoint = config.endpoint || `/api/${config.entityType}/${value}/exists`;

        try {
            const response = await fetchApi({ path: endpoint });
            return (response.data as { exists: boolean }).exists;
        } catch (error) {
            console.error('Exists validation error:', error);
            return false;
        }
    };
};

/**
 * Generic relationship validator
 * Checks if related entity exists and is accessible with required permissions
 *
 * @param config - Configuration for the relationship validator
 * @returns Async validator function
 */
export const createRelationshipValidator = (
    config: RelationshipValidatorConfig
): AsyncValidatorFn => {
    return async (value: unknown, _context?: ValidationContext) => {
        if (!value || typeof value !== 'string') return true;

        const endpoint = config.endpoint || `/api/${config.entityType}/${value}/accessible`;

        try {
            const response = await fetchApi({
                path: endpoint,
                method: 'POST',
                body: {
                    requiredPermissions: config.requiredPermissions || []
                }
            });
            return (response.data as { accessible: boolean }).accessible;
        } catch (error) {
            console.error('Relationship validation error:', error);
            return false;
        }
    };
};

/**
 * Email format validator (async version for server-side validation)
 *
 * @param config - Optional configuration
 * @returns Async validator function
 */
export const createEmailValidator = (config?: {
    endpoint?: string;
    checkDomain?: boolean;
}): AsyncValidatorFn => {
    return async (value: unknown) => {
        if (!value || typeof value !== 'string') return true;

        // Basic email format check first
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) return false;

        // If domain checking is enabled, validate with server
        if (config?.checkDomain) {
            const endpoint = config.endpoint || '/api/validation/email';

            try {
                const response = await fetchApi({
                    path: endpoint,
                    method: 'POST',
                    body: { email: value }
                });
                return (response.data as { isValid: boolean }).isValid;
            } catch (error) {
                console.error('Email validation error:', error);
                return false;
            }
        }

        return true;
    };
};

/**
 * URL validator (async version for server-side validation)
 *
 * @param config - Optional configuration
 * @returns Async validator function
 */
export const createUrlValidator = (config?: {
    endpoint?: string;
    checkReachability?: boolean;
    allowedProtocols?: string[];
}): AsyncValidatorFn => {
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
                const endpoint = config.endpoint || '/api/validation/url';

                try {
                    const response = await fetchApi({
                        path: endpoint,
                        method: 'POST',
                        body: { url: value }
                    });
                    return (response.data as { isReachable: boolean }).isReachable;
                } catch (error) {
                    console.error('URL validation error:', error);
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
 * Predefined common async validators
 * These are ready-to-use validators for common scenarios
 */
export const commonAsyncValidators = {
    /**
     * Validates that a slug is unique for the given entity type
     */
    uniqueSlug: (entityType: string, excludeId?: string) =>
        createUniqueValidator({ entityType, field: 'slug', excludeId }),

    /**
     * Validates that an email is unique for the given entity type
     */
    uniqueEmail: (entityType: string, excludeId?: string) =>
        createUniqueValidator({ entityType, field: 'email', excludeId }),

    /**
     * Validates that a name is unique for the given entity type
     */
    uniqueName: (entityType: string, excludeId?: string) =>
        createUniqueValidator({ entityType, field: 'name', excludeId }),

    /**
     * Validates that a destination exists and is accessible
     */
    destinationExists: () => createExistsValidator({ entityType: 'destinations' }),

    /**
     * Validates that a user exists and is accessible
     */
    userExists: () => createExistsValidator({ entityType: 'users' }),

    /**
     * Validates that an event exists and is accessible
     */
    eventExists: () => createExistsValidator({ entityType: 'events' }),

    /**
     * Validates that a post exists and is accessible
     */
    postExists: () => createExistsValidator({ entityType: 'posts' }),

    /**
     * Validates that a feature exists and is accessible
     */
    featureExists: () => createExistsValidator({ entityType: 'features' }),

    /**
     * Validates that an amenity exists and is accessible
     */
    amenityExists: () => createExistsValidator({ entityType: 'amenities' }),

    /**
     * Validates that a tag exists and is accessible
     */
    tagExists: () => createExistsValidator({ entityType: 'tags' }),

    /**
     * Validates that an owner (user) is accessible with proper permissions
     */
    ownerAccessible: () =>
        createRelationshipValidator({
            entityType: 'users',
            requiredPermissions: ['user.view']
        }),

    /**
     * Validates email format and optionally domain
     */
    validEmail: (checkDomain = false) => createEmailValidator({ checkDomain }),

    /**
     * Validates URL format and optionally reachability
     */
    validUrl: (checkReachability = false, allowedProtocols = ['http:', 'https:']) =>
        createUrlValidator({ checkReachability, allowedProtocols })
};

/**
 * Utility to create a debounced async validator
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
                    console.error('Debounced validation error:', error);
                    resolve(false);
                }
            }, debounceMs);
        });
    };
};

/**
 * Utility to combine multiple async validators with AND logic
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
 * Utility to combine multiple async validators with OR logic
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
