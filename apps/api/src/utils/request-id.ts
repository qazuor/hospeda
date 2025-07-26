/**
 * Utility function to generate unique request IDs
 */

/**
 * Generate a unique request ID
 */
export const generateRequestId = (): string => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
