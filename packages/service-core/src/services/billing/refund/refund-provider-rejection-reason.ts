type ProviderErrorLike = {
    readonly message?: unknown;
    readonly cause?: unknown;
    readonly httpStatus?: unknown;
};

function truncated(value: unknown): unknown {
    return typeof value === 'string' && value.length > 500 ? value.slice(0, 500) : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeCauseEntries(value: readonly unknown[]): readonly Record<string, unknown>[] {
    return value.slice(0, 4).flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const allowed: Record<string, unknown> = {};
        if (typeof entry.code === 'string' || typeof entry.code === 'number')
            allowed.code = truncated(entry.code);
        if (typeof entry.description === 'string')
            allowed.description = truncated(entry.description);
        return Object.keys(allowed).length === 0 ? [] : [allowed];
    });
}

function safeCause(value: unknown, errorHttpStatus?: unknown): unknown {
    if (typeof value === 'string') return { message: truncated(value) };
    if (Array.isArray(value)) return safeCauseEntries(value);
    if (!isRecord(value)) return { message: truncated(String(value)) };
    const isWrappedBody = typeof value.status === 'number' && isRecord(value.body);
    const body = isWrappedBody ? (value.body as Record<string, unknown>) : value;
    const result: Record<string, unknown> = {};
    if (typeof value.httpStatus === 'number') result.httpStatus = value.httpStatus;
    else if (typeof errorHttpStatus === 'number') result.httpStatus = errorHttpStatus;
    else if (isWrappedBody) result.httpStatus = value.status;
    for (const key of ['message', 'error'] as const) {
        if (typeof body[key] === 'string') result[key] = truncated(body[key]);
    }
    if (Array.isArray(body.cause)) result.cause = safeCauseEntries(body.cause);
    return result;
}

/** Returns only provider rejection details approved for persistence and logs. */
export function describeProviderRejection(input: { readonly error: unknown }): {
    readonly message: string;
    readonly cause?: unknown;
} {
    const error = input.error as ProviderErrorLike;
    const message = truncated(
        typeof error?.message === 'string' ? error.message : String(input.error)
    ) as string;
    if (error?.cause === undefined) return { message };
    let cause = safeCause(error.cause, error.httpStatus);
    try {
        JSON.stringify(error.cause);
        if (JSON.stringify(cause).length > 2000) {
            if (isRecord(cause) && Array.isArray(cause.cause)) {
                while (cause.cause.length > 0 && JSON.stringify(cause).length > 2000)
                    cause.cause.pop();
            }
            if (Array.isArray(cause)) {
                while (cause.length > 0 && JSON.stringify(cause).length > 2000) cause.pop();
            }
            if (JSON.stringify(cause).length > 2000)
                cause = `${JSON.stringify(cause).slice(0, 1980)}…[truncated]`;
        }
    } catch {
        cause = safeCause(String(error.cause), error.httpStatus);
    }
    return { message, cause };
}
