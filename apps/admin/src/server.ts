import { createClerkHandler } from '@clerk/tanstack-react-start/server';
import {
    createStartHandler,
    defaultStreamHandler,
    defineHandlerCallback
} from '@tanstack/react-start/server';
import { createRouter } from './router';

const handlerFactory = createClerkHandler(
    createStartHandler({
        createRouter
    }),
    {
        secretKey: process.env.CLERK_SECRET_KEY,
        publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY
    }
);

export default defineHandlerCallback(async (event) => {
    const startHandler = await handlerFactory(defaultStreamHandler);
    return startHandler(event);
});
