/**
 * Provenance marker for "this error came from reading the provider" (HOS-914).
 *
 * `processSubscriptionUpdated` does many things that can throw: it reads the
 * preapproval from MercadoPago, then writes a status, inserts an audit row,
 * dispatches notifications and drives two reconciler bridges. A caller that
 * catches around the whole call sees one `Error` and cannot tell which phase
 * produced it — and guessing from the message is worse than not guessing:
 * `Error('Notification template not found')` matches every "not found" heuristic
 * there is while saying nothing about the preapproval.
 *
 * That distinction is load-bearing for `subscription-drift-reconcile`, which
 * treats a preapproval MercadoPago cannot resolve as an anomaly needing a human.
 * Misattributing a mailer failure to the provider sends someone hunting for a
 * preapproval that is perfectly fine; misattributing it the other way is how an
 * unreadable row gets retried in silence forever.
 *
 * So the producer marks and the consumer reads the mark. Only the `.catch` on the
 * `subscriptions.retrieve()` call stamps an error, and only a stamped error may be
 * classified as a provider read failure. Unmarked errors are, by construction,
 * something else.
 *
 * @module routes/webhooks/mercadopago/provider-read-failure
 */

/**
 * Property stamped onto an error thrown by a provider read.
 *
 * A `Symbol` rather than a string key on purpose: it cannot collide with a
 * provider SDK's own fields, it does not serialize into logs or Sentry payloads
 * as mystery noise, and it cannot be forged by a JSON-shaped error that happens
 * to carry the same property name.
 */
export const PROVIDER_READ_FAILURE = Symbol.for('hospeda.providerReadFailure');

/**
 * Stamp an error as having come from a provider read.
 *
 * Total and silent by design: a thrown non-object (a string, `undefined`) cannot
 * carry a mark, and refusing to stamp it is correct — {@link isProviderReadFailure}
 * then reports `false`, which routes it to the conservative branch rather than
 * escalating it to a human.
 *
 * @param error - Whatever the provider call threw. Mutated in place when it is an
 *   object; ignored otherwise.
 */
export function markProviderReadFailure(error: unknown): void {
    if (typeof error === 'object' && error !== null) {
        Object.defineProperty(error, PROVIDER_READ_FAILURE, {
            value: true,
            // Non-enumerable so the mark never leaks into a log line, a JSON
            // serialization or a Sentry payload.
            enumerable: false,
            configurable: true,
            writable: false
        });
    }
}

/**
 * Whether this error was stamped by a provider read.
 *
 * @param error - The caught value.
 * @returns `true` only for an error {@link markProviderReadFailure} stamped.
 */
export function isProviderReadFailure(error: unknown): boolean {
    return (
        typeof error === 'object' &&
        error !== null &&
        (error as Record<symbol, unknown>)[PROVIDER_READ_FAILURE] === true
    );
}
