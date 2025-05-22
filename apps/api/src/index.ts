import { apiLogger } from '@/utils/logger';
import { serve } from '@hono/node-server';
import 'dotenv/config';
import { app } from './app';

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 3000;

apiLogger.info({ location: 'API:Startup' }, `Starting API server on port ${PORT}`);
apiLogger.info(
    'Starting API server on port lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
    'texto largo'
);

apiLogger.warn(
    {
        location: 'API:Startup',
        textLargo:
            'Starting API server on port lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.'
    },
    `Starting API server on port ${PORT}`
);
apiLogger.error({ location: 'API:Startup' }, `Starting API server on port ${PORT}`);
apiLogger.debug({ location: 'API:Startup' }, `Starting API server on port ${PORT}`);
apiLogger.log({ location: 'API:Startup' }, `Starting API server on port ${PORT}`);

serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0'
});

process.on('unhandledRejection', (reason) => {
    const errorToLog = reason instanceof Error ? reason : new Error(String(reason));
    apiLogger.error(
        errorToLog,
        `API:UnhandledRejection - Unhandled Rejection. Reason: ${String(reason)}`
    );
});

process.on('uncaughtException', (error) => {
    apiLogger.error(error, 'API:UncaughtException - Uncaught Exception');
    process.exit(1);
});
