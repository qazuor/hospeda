import { createRouter } from '../../utils/create-app';
import { submitContactRoute } from './submit';

export const contactRoutes = createRouter().route('/', submitContactRoute);
