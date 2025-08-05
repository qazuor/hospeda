import { setupRoutes } from './routes';
import configureOpenAPI from './utils/configure-open-api';
import createApp from './utils/create-app';

const initApp = () => {
    const app = createApp();

    configureOpenAPI(app);

    setupRoutes(app);

    return app;
};

export { initApp };
