/**
 * Public testimonials routes
 * Routes that don't require authentication
 */
import { createRouter } from '../../../utils/create-app';
import { publicListTestimonialsRoute } from './list';

const app = createRouter();

// GET / - List testimonials
app.route('/', publicListTestimonialsRoute);

export { app as publicTestimonialRoutes };
