/** Raised when another worker has already closed the current slice. */
export class SweepLeaseLostError extends Error {
    constructor() {
        super('Reconciliation sweep lease was lost');
        this.name = 'SweepLeaseLostError';
    }
}

/** Raised when a cooperative signal or deadline stops an in-progress pass. */
export class SweepTimedOutError extends Error {
    constructor() {
        super('Reconciliation sweep reached its cooperative deadline');
        this.name = 'SweepTimedOutError';
    }
}
