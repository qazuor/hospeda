import type { Env } from '@/types';
import { Hono } from 'hono';
import { accommodationRouter } from './accommodations';

const apiV1Router = new Hono<Env>();

apiV1Router.get('/text', (c) => {
    return c.text('Hello V1 Hono API text!');
});
apiV1Router.get('/json', (c) => {
    return c.json({ value: 'Hello V1 Hono API in Json!' });
});

// Mount all entity routes
apiV1Router.route('/accommodations', accommodationRouter);

// Auth routes
// apiV1Router.route('/auth', authRouter);

// Email routes
// apiV1Router.route('/email', emailRouter);

export { apiV1Router };
