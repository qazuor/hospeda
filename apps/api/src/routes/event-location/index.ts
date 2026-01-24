import { createRouter } from '../../utils/create-app';
import { adminHardDeleteEventLocationRoute } from './admin/hardDelete';
import { adminListEventLocationsRoute } from './admin/list';
import { adminRestoreEventLocationRoute } from './admin/restore';
import { protectedCreateEventLocationRoute } from './protected/create';
import { protectedPatchEventLocationRoute } from './protected/patch';
import { protectedSoftDeleteEventLocationRoute } from './protected/softDelete';
import { protectedUpdateEventLocationRoute } from './protected/update';
import { publicGetEventLocationByIdRoute } from './public/getById';
import { publicGetEventLocationBySlugRoute } from './public/getBySlug';
import { publicListEventLocationsRoute } from './public/list';

const app = createRouter();

// Public routes
app.route('/', publicListEventLocationsRoute);
app.route('/', publicGetEventLocationByIdRoute);
app.route('/', publicGetEventLocationBySlugRoute);

// Protected routes
app.route('/', protectedCreateEventLocationRoute);
app.route('/', protectedUpdateEventLocationRoute);
app.route('/', protectedPatchEventLocationRoute);
app.route('/', protectedSoftDeleteEventLocationRoute);

// Admin routes
app.route('/', adminListEventLocationsRoute);
app.route('/', adminRestoreEventLocationRoute);
app.route('/', adminHardDeleteEventLocationRoute);

export { app as eventLocationRoutes };
