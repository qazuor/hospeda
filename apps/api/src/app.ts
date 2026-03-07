import { setupRoutes } from './routes';
import { configureOpenAPI } from './utils/configure-open-api';
import { createApp } from './utils/create-app';
import { env } from './utils/env';

const initApp = () => {
    const app = createApp();

    setupRoutes(app);

    // Configure OpenAPI AFTER all routes are registered (only in non-production)
    if (env.NODE_ENV !== 'production') {
        configureOpenAPI(app);
    }

    return app;
};

export { initApp };
