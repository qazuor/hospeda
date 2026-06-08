import { createRouter } from '../../../utils/create-app.js';
import { adminContentModerationHealthRoute } from './health.js';

const app = createRouter();

app.route('/', adminContentModerationHealthRoute);

export { app as adminContentModerationRoutes };
