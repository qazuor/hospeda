import * as Sentry from '@sentry/astro';
import { getConsent } from './src/lib/cookie-consent';

const dsn = import.meta.env.PUBLIC_SENTRY_DSN;

// Only initialize Sentry when the user has consented to analytics cookies.
// If no consent cookie exists (first visit), Sentry stays silent until the
// user accepts and the page reloads or the next navigation picks up the cookie.
const consent = getConsent();
const analyticsAllowed = consent?.analytics === true;

if (dsn && analyticsAllowed) {
    Sentry.init({
        dsn,
        environment: import.meta.env.MODE || 'development',
        release: import.meta.env.PUBLIC_SENTRY_RELEASE || 'development',

        initialScope: {
            tags: {
                project: 'hospeda',
                app_type: 'web2'
            }
        },

        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,

        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({
                maskAllText: false,
                blockAllMedia: false
            })
        ],

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

        beforeBreadcrumb(breadcrumb) {
            if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
                return null;
            }
            return breadcrumb;
        }
    });
}
