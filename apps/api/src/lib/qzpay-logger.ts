/**
 * Adapter between hospeda's `apiLogger` (pino-style: `(meta, message)`) and
 * the `QZPayLogger` interface expected by `@qazuor/qzpay-*` packages
 * (parameter order: `(message, meta?)`).
 *
 * Pass `qzpayLogger` to QZPay's webhook adapter / hono middleware so all
 * qzpay-side logs land in the API's structured log stream instead of
 * `console.*`.
 */

import type { QZPayLogMeta, QZPayLogger } from '@qazuor/qzpay-core';
import { apiLogger } from '../utils/logger';

export const qzpayLogger: QZPayLogger = {
    debug: (message: string, meta?: QZPayLogMeta): void => {
        apiLogger.debug(meta ?? {}, message);
    },
    info: (message: string, meta?: QZPayLogMeta): void => {
        apiLogger.info(meta ?? {}, message);
    },
    warn: (message: string, meta?: QZPayLogMeta): void => {
        apiLogger.warn(meta ?? {}, message);
    },
    error: (message: string, meta?: QZPayLogMeta): void => {
        apiLogger.error(meta ?? {}, message);
    }
};
