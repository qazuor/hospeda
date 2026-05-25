import { setupRoutes } from './routes';
import { configureOpenAPI } from './utils/configure-open-api';
import { createApp } from './utils/create-app';
import { registerEntityFetchers } from './utils/entity-fetchers';
import { env } from './utils/env';

const initApp = () => {
    // Wire entity fetchers BEFORE any route handlers can run so the
    // ownershipMiddleware (used by protected accommodation patch/update/softDelete
    // and similar) can resolve entities. Without this call the fetchers Map is
    // empty and every ownership-guarded route fails with HTTP 500
    // "Entity type not configured".
    registerEntityFetchers();

    const app = createApp();

    setupRoutes(app);

    // Configure OpenAPI AFTER all routes are registered (only in non-production)
    if (env.NODE_ENV !== 'production') {
        configureOpenAPI(app);
    }

    return app;
};

export { initApp };
