/**
 * A minimal, always-serializable description of any thrown value.
 *
 * Unlike a raw `Error`, every field here is guaranteed to be a plain string (or absent),
 * so it can always be safely interpolated into a template literal without producing the
 * useless `[object Object]` output that a bare `${error.message}` produces when `error`
 * (or `error.message`) is not actually a string.
 */
export interface ErrorDescription {
    /** Human-readable message. Never the literal string `[object Object]`. */
    message: string;
    /** Stack trace, when the original value carried a string one. */
    stack?: string;
    /** Human-readable description of `error.cause`, when present. */
    cause?: string;
}

const CIRCULAR_PLACEHOLDER = '[Circular]';

/**
 * `JSON.stringify`s a value, replacing circular references with a placeholder instead of
 * throwing `TypeError: Converting circular structure to JSON`, and falling back to
 * `String(value)` for values `JSON.stringify` cannot represent (e.g. `undefined`,
 * functions, symbols) or that fail to stringify for any other reason.
 */
function safeStringify(value: unknown): string {
    const seen = new WeakSet<object>();

    try {
        const json = JSON.stringify(value, (_key, val) => {
            if (typeof val === 'bigint') {
                return `${val}n`;
            }
            if (typeof val === 'object' && val !== null) {
                if (seen.has(val)) {
                    return CIRCULAR_PLACEHOLDER;
                }
                seen.add(val);
            }
            return val;
        });

        return json ?? String(value);
    } catch {
        try {
            return String(value);
        } catch {
            return '[Unserializable value]';
        }
    }
}

/**
 * Describes `error.cause` as a readable string, when present.
 *
 * `cause` is itself `unknown` (it can be another `Error`, a plain object, a string, etc.),
 * so it goes through the same normalization as the top-level value instead of being
 * interpolated raw.
 */
function describeCauseValue(cause: unknown): string | undefined {
    if (cause === undefined) {
        return undefined;
    }
    if (cause instanceof Error) {
        return typeof cause.message === 'string' ? cause.message : safeStringify(cause.message);
    }
    if (typeof cause === 'string') {
        return cause;
    }
    return safeStringify(cause);
}

/**
 * Describes an `AggregateError`'s nested `errors[]` as a readable suffix, when present.
 */
function describeAggregateSuffix(err: Error): string | undefined {
    const errors = (err as { errors?: unknown }).errors;
    if (!Array.isArray(errors) || errors.length === 0) {
        return undefined;
    }

    const nested = errors.map((nestedError) => describeError(nestedError).message).join('; ');
    const label = errors.length === 1 ? 'error' : 'errors';
    return `(${errors.length} aggregated ${label}: ${nested})`;
}

/**
 * Describes a genuine `Error` instance.
 *
 * `error.message` is almost always a string, but nothing enforces that at runtime — a
 * dependency can construct (or mutate) an `Error` whose `message` is an object. This is the
 * exact shape that produced the original `[object Object]` bug report (HOS-922): the caught
 * value passed `instanceof Error`, so a naive `(err as Error).message` cast looked safe and
 * type-checked, but the message itself was not a string.
 */
function describeErrorInstance(err: Error): ErrorDescription {
    const rawMessage: unknown = err.message;
    const message = typeof rawMessage === 'string' ? rawMessage : safeStringify(rawMessage);
    const aggregateSuffix = describeAggregateSuffix(err);

    return {
        message: aggregateSuffix ? `${message} ${aggregateSuffix}` : message,
        stack: typeof err.stack === 'string' ? err.stack : undefined,
        cause: describeCauseValue((err as { cause?: unknown }).cause)
    };
}

/**
 * Normalizes any value caught from a `try/catch` block (or a rejected promise) into an
 * always-readable {@link ErrorDescription}.
 *
 * A `catch` clause's binding is typed `unknown`, and at runtime it genuinely can be
 * anything: a real `Error`, a plain object thrown by a driver (a Postgres/Drizzle error
 * shape, a `ZodError`-like object), a bare string, `null`/`undefined`, or an `Error` whose
 * `.message` was itself overwritten with a non-string value. Interpolating any of those
 * directly into a template literal (`` `${(err as Error).message}` ``) either throws at
 * runtime type-checking time or silently prints the useless string `[object Object]` —
 * which is exactly what made HOS-922's CI failure ("San Justo") impossible to diagnose.
 *
 * @param err - The value caught from a `try/catch` block. Always `unknown` at the call site.
 * @returns A description whose `message` is always a real, readable string.
 *
 * @example
 * ```typescript
 * try {
 *   await risky();
 * } catch (err) {
 *   const { message } = describeError(err);
 *   logger.error(`Failed: ${message}`);
 * }
 * ```
 */
export function describeError(err: unknown): ErrorDescription {
    if (err instanceof Error) {
        return describeErrorInstance(err);
    }

    if (typeof err === 'string') {
        return { message: err };
    }

    if (err === null) {
        return { message: '[null thrown]' };
    }

    if (err === undefined) {
        return { message: '[undefined thrown]' };
    }

    // A plain object (or anything else with an object-ish typeof) thrown directly, e.g.
    // `{ code: 23505, detail: 'duplicate key' }` from a raw driver error.
    return { message: safeStringify(err) };
}

/**
 * Normalizes any thrown value into a genuine `Error` instance.
 *
 * Several call sites in this package (e.g. `SeedRunnerOptions.onError`,
 * `errorHistory.recordError`) are typed to receive an `Error`, but the value a `catch`
 * clause actually observes is `unknown`. Returns `err` unchanged when it already is an
 * `Error`; otherwise wraps a readable description (via {@link describeError}) in a new
 * `Error`, keeping the original value reachable through `cause` for further inspection.
 *
 * @param err - The value caught from a `try/catch` block.
 * @returns `err` itself when it is already an `Error`, otherwise a new `Error` wrapping it.
 */
export function toError(err: unknown): Error {
    if (err instanceof Error) {
        return err;
    }

    return new Error(describeError(err).message, { cause: err });
}
