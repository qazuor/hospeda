/**
 * Environment variables interface
 */
export interface Env {
    /**
     * Variables available in the environment
     */
    Variables: {
        /**
         * Current authenticated user
         */
        // user?: User;

        /**
         * Validated request data
         */
        validated?: unknown;
    };
}
