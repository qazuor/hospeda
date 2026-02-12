import {
    createStartHandler,
    defaultStreamHandler,
    defineHandlerCallback
} from '@tanstack/react-start/server';
import { createRouter } from './router';

const handler = createStartHandler({
    createRouter
});

export default defineHandlerCallback(async (event) => {
    const startHandler = await handler(defaultStreamHandler);
    return startHandler(event);
});
