import { createRouter } from '../../../utils/create-app';
import { adminGetFeatureFlagAuditLogRoute } from './auditLog';
import { adminCreateFeatureFlagRoute } from './create';
import { adminDeleteFeatureFlagRoute } from './delete';
import { adminGetFeatureFlagByIdRoute } from './getById';
import { adminListFeatureFlagsRoute } from './list';
import { adminToggleFeatureFlagRoute } from './toggle';
import { adminUpdateFeatureFlagRoute } from './update';

const app = createRouter();
app.route('/', adminListFeatureFlagsRoute);
app.route('/', adminGetFeatureFlagByIdRoute);
app.route('/', adminCreateFeatureFlagRoute);
app.route('/', adminUpdateFeatureFlagRoute);
app.route('/', adminToggleFeatureFlagRoute);
app.route('/', adminDeleteFeatureFlagRoute);
app.route('/', adminGetFeatureFlagAuditLogRoute);
export { app as adminFeatureFlagRoutes };
