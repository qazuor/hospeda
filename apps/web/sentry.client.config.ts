import * as Sentry from '@sentry/astro';

const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

if (dsn) {
    Sentry.init({
        dsn,
        environment: import.meta.env.MODE || 'development',
        release:
            import.meta.env.PUBLIC_SENTRY_RELEASE ||
            import.meta.env.VERCEL_GIT_COMMIT_SHA ||
            'development',

        initialScope: {
            tags: {
                project: 'hospeda',
                app_type: 'web'
            }
        },

        // Performance monitoring: 10% of transactions
        tracesSampleRate: 0.1,

        // Session replay
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,

        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false
            })
        ],

        // Filter sensitive data from events
        beforeSend(event) {
            if (event.request?.headers) {
                const {
                    Authorization: _auth,
                    Cookie: _cookie,
                    'X-Auth-Token': _token,
                    ...cleanHeaders
                } = event.request.headers;
                event.request.headers = cleanHeaders;
            }
            return event;
        },

        // Filter noisy breadcrumbs
        beforeBreadcrumb(breadcrumb) {
            if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
                return null;
            }
            return breadcrumb;
        }
    });
}
