export enum ServiceErrorCode {
    /** Input validation failed */
    VALIDATION_ERROR = 'VALIDATION_ERROR',
    /** Entity not found */
    NOT_FOUND = 'NOT_FOUND',
    /** User is not authenticated */
    UNAUTHORIZED = 'UNAUTHORIZED',
    /** User is not authorized to perform the action */
    FORBIDDEN = 'FORBIDDEN',
    /** Unexpected internal error */
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    /** Entity or assignment already exists */
    ALREADY_EXISTS = 'ALREADY_EXISTS',
    /**
     * Method is not implemented.
     * Use this code for public service methods that are stubs or not yet implemented.
     * Always return this error via the homogeneous pipeline (runWithLoggingAndValidation).
     */
    NOT_IMPLEMENTED = 'NOT_IMPLEMENTED'
}
