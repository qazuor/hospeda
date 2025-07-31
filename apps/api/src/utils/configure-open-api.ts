import packageJSON from '../../package.json' with { type: 'json' };
import type { AppOpenAPI } from '../types';
import { env } from './env';

export default function configureOpenAPI(app: AppOpenAPI) {
    app.doc('/docs/openapi.json', {
        openapi: '3.0.0',
        info: {
            title: packageJSON.name,
            version: packageJSON.version,
            description: packageJSON.description
        },
        servers: [
            {
                url: `http://${env.API_HOST}:${env.API_PORT}`,
                description: 'Development server'
            }
        ]
    });

    // app.get(
    //     '/docs/reference',
    //     Scalar({
    //         url: '/docs/openapi.json',
    //         theme: 'kepler',
    //         layout: 'classic',
    //         defaultHttpClient: {
    //             targetKey: 'js',
    //             clientKey: 'fetch'
    //         }
    //         // biome-ignore lint/suspicious/noExplicitAny: Scalar middleware has type compatibility issues with Hono versions
    //     }) as any
    // );
}
