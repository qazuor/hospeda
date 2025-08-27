import { adminLogger } from '@/utils/logger';
import { useCallback, useRef, useState } from 'react';

/**
 * Configuration for async validation
 */
export type AsyncValidationConfig = {
    /** Debounce delay in milliseconds */
    readonly debounceMs?: number;
    /** Cache validation results */
    readonly enableCache?: boolean;
    /** Cache TTL in milliseconds */
    readonly cacheTtl?: number;
    /** Retry failed validations */
    readonly retryOnError?: boolean;
    /** Maximum retry attempts */
    readonly maxRetries?: number;
};

/**
 * Async validation function type
 */
export type AsyncValidator<T = string> = (value: T) => Promise<string | null>;

/**
 * Validation state for a field
 */
export type ValidationState = {
    /** Current validation status */
    readonly status: 'idle' | 'validating' | 'valid' | 'invalid';
    /** Validation error message if invalid */
    readonly error: string | null;
    /** Whether validation is in progress */
    readonly isValidating: boolean;
    /** Whether the field has been validated at least once */
    readonly hasValidated: boolean;
    /** Last validation timestamp */
    readonly lastValidated: number | null;
};

/**
 * Cache entry for validation results
 */
type CacheEntry = {
    readonly result: string | null;
    readonly timestamp: number;
};

/**
 * Hook for async field validation with debouncing and caching
 *
 * Provides async validation capabilities with automatic debouncing,
 * result caching, and error handling for form fields.
 *
 * @example
 * ```tsx
 * const emailValidator = async (email: string) => {
 *   const response = await fetchApi('/api/validate/email', {
 *     method: 'POST',
 *     body: { email }
 *   });
 *   return response.data.isUnique ? null : 'Email already exists';
 * };
 *
 * const { validate, state, clearValidation } = useAsyncValidation(
 *   emailValidator,
 *   { debounceMs: 500, enableCache: true }
 * );
 *
 * // In form field
 * <input
 *   onChange={(e) => validate(e.target.value)}
 *   className={state.status === 'invalid' ? 'border-red-500' : ''}
 * />
 * {state.error && <span className="text-red-500">{state.error}</span>}
 * {state.isValidating && <span>Validating...</span>}
 * ```
 */
export const useAsyncValidation = <T = string>(
    validator: AsyncValidator<T>,
    config: AsyncValidationConfig = {}
) => {
    const {
        debounceMs = 300,
        enableCache = true,
        cacheTtl = 5 * 60 * 1000, // 5 minutes
        retryOnError = true,
        maxRetries = 2
    } = config;

    // Validation state
    const [state, setState] = useState<ValidationState>({
        status: 'idle',
        error: null,
        isValidating: false,
        hasValidated: false,
        lastValidated: null
    });

    // Refs for debouncing and caching
    const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
    const abortControllerRef = useRef<AbortController | null>(null);
    const retryCountRef = useRef<number>(0);

    // Clear cache entries that have expired
    const clearExpiredCache = useCallback(() => {
        if (!enableCache) return;

        const now = Date.now();
        const cache = cacheRef.current;

        for (const [key, entry] of cache.entries()) {
            if (now - entry.timestamp > cacheTtl) {
                cache.delete(key);
            }
        }
    }, [enableCache, cacheTtl]);

    // Get cached result if available and not expired
    const getCachedResult = useCallback(
        (value: T): string | null | undefined => {
            if (!enableCache) return undefined;

            const cacheKey = JSON.stringify(value);
            const cached = cacheRef.current.get(cacheKey);

            if (cached && Date.now() - cached.timestamp <= cacheTtl) {
                return cached.result;
            }

            return undefined;
        },
        [enableCache, cacheTtl]
    );

    // Cache validation result
    const setCachedResult = useCallback(
        (value: T, result: string | null) => {
            if (!enableCache) return;

            const cacheKey = JSON.stringify(value);
            cacheRef.current.set(cacheKey, {
                result,
                timestamp: Date.now()
            });

            // Clean up expired entries periodically
            clearExpiredCache();
        },
        [enableCache, clearExpiredCache]
    );

    // Perform the actual validation
    const performValidation = useCallback(
        async (value: T): Promise<void> => {
            // Cancel any ongoing validation
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }

            // Create new abort controller
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            // Check cache first
            const cachedResult = getCachedResult(value);
            if (cachedResult !== undefined) {
                setState((prev) => ({
                    ...prev,
                    status: cachedResult ? 'invalid' : 'valid',
                    error: cachedResult,
                    isValidating: false,
                    hasValidated: true,
                    lastValidated: Date.now()
                }));
                return;
            }

            // Set validating state
            setState((prev) => ({
                ...prev,
                status: 'validating',
                isValidating: true,
                error: null
            }));

            try {
                // Perform validation
                const result = await validator(value);

                // Check if validation was aborted
                if (abortController.signal.aborted) {
                    return;
                }

                // Cache the result
                setCachedResult(value, result);

                // Update state with result
                setState((prev) => ({
                    ...prev,
                    status: result ? 'invalid' : 'valid',
                    error: result,
                    isValidating: false,
                    hasValidated: true,
                    lastValidated: Date.now()
                }));

                // Reset retry count on success
                retryCountRef.current = 0;
            } catch (error) {
                // Check if validation was aborted
                if (abortController.signal.aborted) {
                    return;
                }

                adminLogger.error(
                    'Async validation failed:',
                    error instanceof Error ? error.message : 'Unknown error'
                );

                // Handle retry logic
                if (retryOnError && retryCountRef.current < maxRetries) {
                    retryCountRef.current++;
                    adminLogger.info(
                        `Retrying validation (attempt ${retryCountRef.current}/${maxRetries})`
                    );

                    // Retry after a short delay
                    setTimeout(() => {
                        performValidation(value);
                    }, 1000 * retryCountRef.current); // Exponential backoff

                    return;
                }

                // Set error state
                setState((prev) => ({
                    ...prev,
                    status: 'invalid',
                    error: 'Validation failed. Please try again.',
                    isValidating: false,
                    hasValidated: true,
                    lastValidated: Date.now()
                }));

                // Reset retry count
                retryCountRef.current = 0;
            }
        },
        [validator, getCachedResult, setCachedResult, retryOnError, maxRetries]
    );

    // Debounced validation function
    const validate = useCallback(
        (value: T) => {
            // Clear existing timeout
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }

            // Set new timeout
            debounceTimeoutRef.current = setTimeout(() => {
                performValidation(value);
            }, debounceMs);
        },
        [performValidation, debounceMs]
    );

    // Immediate validation (no debounce)
    const validateImmediate = useCallback(
        (value: T) => {
            // Clear any pending debounced validation
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }

            performValidation(value);
        },
        [performValidation]
    );

    // Clear validation state
    const clearValidation = useCallback(() => {
        // Cancel any ongoing validation
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }

        // Clear debounce timeout
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        // Reset state
        setState({
            status: 'idle',
            error: null,
            isValidating: false,
            hasValidated: false,
            lastValidated: null
        });

        // Reset retry count
        retryCountRef.current = 0;
    }, []);

    // Clear cache
    const clearCache = useCallback(() => {
        cacheRef.current.clear();
    }, []);

    // Get cache stats for debugging
    const getCacheStats = useCallback(() => {
        return {
            size: cacheRef.current.size,
            entries: Array.from(cacheRef.current.entries()).map(([key, entry]) => ({
                key,
                result: entry.result,
                age: Date.now() - entry.timestamp
            }))
        };
    }, []);

    // Cleanup on unmount
    const cleanup = useCallback(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    }, []);

    return {
        // Validation functions
        validate,
        validateImmediate,
        clearValidation,

        // State
        state,

        // Cache management
        clearCache,
        getCacheStats,

        // Cleanup
        cleanup,

        // Computed properties
        isValid: state.status === 'valid',
        isInvalid: state.status === 'invalid',
        isPending: state.isValidating,
        hasError: state.status === 'invalid' && !!state.error
    };
};
