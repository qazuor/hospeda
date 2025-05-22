import logger, { LoggerColors } from '@repo/logger';

const apiLogger = logger.registerCategory('Api', 'API', {
    color: LoggerColors.CYAN
});

export { apiLogger };
