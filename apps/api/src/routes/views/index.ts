import { createRouter } from '../../utils/create-app';
import { captureViewRoute } from './capture';

export const viewsRoutes = createRouter().route('/', captureViewRoute);
