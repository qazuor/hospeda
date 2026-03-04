import { setupRoutes } from './routes';
import { configureOpenAPI } from './utils/configure-open-api';
import { createApp } from './utils/create-app';

const initApp = () => {
    const app = createApp();

    setupRoutes(app);

    // Configure OpenAPI AFTER all routes are registered (only in non-production)
    if (process.env.NODE_ENV !== 'production') {
        configureOpenAPI(app);
    }

    return app;
};

export { initApp };
