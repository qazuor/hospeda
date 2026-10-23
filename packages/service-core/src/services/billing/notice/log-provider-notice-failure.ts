import { createLogger } from '@repo/logger';
import { PaymentProviderError } from '@repo/payments';

const logger = createLogger('process-provider-notice');

/**
 * Logs provider notice failures, deferring incomplete reads without Sentry capture (HOS-1747).
 * Mercado Pago retries a 500 response, so its transient write race should be WARN only.
 */
export function logProviderNoticeFailure(input: {
    readonly error: unknown;
    readonly channel: 'WEBHOOKS' | 'IPN';
}): void {
    if (input.error instanceof PaymentProviderError && input.error.incompleteRead) {
        logger.warn(
            input.error,
            `Provider notice deferred: provider record still being written (channel: ${input.channel})`
        );
        return;
    }
    logger.error(input.error, `Provider notice processing failed (channel: ${input.channel})`, {
        capture: true
    });
}
