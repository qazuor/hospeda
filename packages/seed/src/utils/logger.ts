import { logger as baseLogger } from '@repo/logger';

export const logger = {
    info: (msg: string) => baseLogger.info(msg),
    success: (msg: string) => baseLogger.info(`✅ ${msg}`),
    warn: (msg: string) => baseLogger.warn(msg),
    error: (msg: string) => baseLogger.error(msg),
    dim: (msg: string) => baseLogger.debug(msg)
};
