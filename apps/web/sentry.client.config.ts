import * as Sentry from '@sentry/astro';
import { getConsent } from './src/lib/cookie-consent';

const dsn = import.meta.env.PUBLIC_SENTRY_DSN;
// Prefer PUBLIC_SENTRY_ENVIRONMENT over MODE so staging and prod (both
// MODE=production) end up in different Sentry environments. Falls back
// to MODE when the explicit override is unset.
const environment =
    import.meta.env.PUBLIC_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development';

// Only initialize Sentry when the user has consented to crash reporting.
// Crash reporting is its own consent category (separate from analytics) so
// users who opt out of behavioural tracking can still opt in to error
// reporting that helps us fix bugs that affect them. If no consent cookie
// exists (first visit), Sentry stays silent until the user opts in.
const consent = getConsent();
const crashReportingAllowed = consent?.crashReporting === true;

if (dsn && crashReportingAllowed) {
    Sentry.init({
        dsn,
        environment,
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
