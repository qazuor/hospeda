// Standardized error class for the DB layer

/**
 * Custom error class for database operations, including full context.
 * @class
 * @extends Error
 */
export class DbError extends Error {
    /**
     * The entity (table/model) where the error occurred.
     */
    public entity: string;
    /**
     * The method or action where the error occurred.
     */
    public method: string;
    /**
     * The parameters used in the operation.
     */
    public params: unknown;

    /**
     * Creates a new DbError instance.
     * @param entity - The entity (table/model) name
     * @param method - The method or action name
     * @param params - The parameters used in the operation
     * @param message - The error message
     * @param cause - Optional original error that caused this DbError
     */
    constructor(entity: string, method: string, params: unknown, message: string, cause?: Error) {
        super(message, { cause });
        this.name = 'DbError';
        this.entity = entity;
        this.method = method;
        this.params = params;
        Object.setPrototypeOf(this, DbError.prototype);
    }
}

/**
 * Helper to throw a DbError with full context.
 * @param entity - The entity (table/model) name
 * @param method - The method or action name
 * @param params - The parameters used in the operation
 * @param message - The error message
 * @throws {DbError}
 */
export const throwDbError = (
    entity: string,
    method: string,
    params: unknown,
    message: string
): never => {
    throw new DbError(entity, method, params, message);
};
