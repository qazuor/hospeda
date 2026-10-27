import * as Sentry from '@sentry/astro';
import { SENTRY_DATA_COLLECTION, scrubSentryEvent } from './src/lib/observability/sentry-privacy';

const dsn = import.meta.env.PUBLIC_SENTRY_DSN;
// Prefer PUBLIC_SENTRY_ENVIRONMENT over MODE so staging and prod (both
// MODE=production) end up in different Sentry environments. Falls back
// to MODE when the explicit override is unset.
const environment =
    import.meta.env.PUBLIC_SENTRY_ENVIRONMENT || import.meta.env.MODE || 'development';

if (dsn) {
    Sentry.init({
        dsn,
        environment,
        release:
            import.meta.env.PUBLIC_SENTRY_RELEASE || process.env.HOSPEDA_GIT_SHA || 'development',

        initialScope: {
            tags: {
                project: 'hospeda',
                app_type: 'web'
            }
        },

        tracesSampleRate: import.meta.env.PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0.1,

        // v11 `dataCollection` defaults are permissive; pin the restrictive posture.
        dataCollection: SENTRY_DATA_COLLECTION,

        beforeSend: scrubSentryEvent,

        beforeBreadcrumb(breadcrumb) {
            if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
                return null;
            }
            return breadcrumb;
        }
    });
}
