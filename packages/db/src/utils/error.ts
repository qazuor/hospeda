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
 * @param cause - Optional original error that caused this DbError
 * @throws {DbError}
 */
export const throwDbError = (
    entity: string,
    method: string,
    params: unknown,
    message: string,
    cause?: Error
): never => {
    throw new DbError(entity, method, params, message, cause);
};

/**
 * Thrown to intentionally abort a transaction. Re-thrown by withTransaction without wrapping in DbError.
 *
 * Use this as a sentinel when a caller needs to roll back a transaction on purpose rather than due to
 * an unexpected database failure. `withTransaction` catches this error and re-throws it as-is so callers
 * can distinguish intentional rollbacks from actual DB errors.
 *
 * @example
 * ```ts
 * await withTransaction(async (tx) => {
 *   const existing = await userModel.findOne({ email }, tx);
 *   if (existing) {
 *     throw new TransactionRollbackError('User already exists');
 *   }
 *   await userModel.create(data, tx);
 * });
 * ```
 */
export class TransactionRollbackError extends Error {
    readonly name = 'TransactionRollbackError';

    /**
     * Creates a new TransactionRollbackError.
     * @param message - Description of why the transaction was rolled back
     * @param cause - Optional underlying error that triggered the rollback decision
     */
    constructor(message = 'Transaction intentionally rolled back', cause?: Error) {
        super(message, { cause });
        Object.setPrototypeOf(this, TransactionRollbackError.prototype);
    }
}
