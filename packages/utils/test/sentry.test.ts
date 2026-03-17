import { describe, expect, it } from 'vitest';
import { buildSentryReportUri } from '../src/sentry';

describe('buildSentryReportUri', () => {
    it('returns a valid report URI for a valid DSN', () => {
        const result = buildSentryReportUri({
            dsn: 'https://abc123@o123456.ingest.sentry.io/4567890'
        });

        expect(result).toBe(
            'https://o123456.ingest.sentry.io/api/4567890/security/?sentry_key=abc123'
        );
    });

    it('returns null for an invalid DSN string', () => {
        const result = buildSentryReportUri({ dsn: 'not-a-valid-url' });

        expect(result).toBeNull();
    });

    it('returns null when the DSN is missing the project ID', () => {
        const result = buildSentryReportUri({ dsn: 'https://abc123@o123456.ingest.sentry.io/' });

        expect(result).toBeNull();
    });

    it('returns null when the DSN is missing the key (username)', () => {
        const result = buildSentryReportUri({
            dsn: 'https://o123456.ingest.sentry.io/4567890'
        });

        expect(result).toBeNull();
    });

    it('returns null for an empty DSN string', () => {
        const result = buildSentryReportUri({ dsn: '' });

        expect(result).toBeNull();
    });

    it('handles DSNs with sub-paths in the project ID', () => {
        const result = buildSentryReportUri({
            dsn: 'https://mykey@sentry.example.com/42'
        });

        expect(result).toBe('https://sentry.example.com/api/42/security/?sentry_key=mykey');
    });

    it('handles DSNs with custom Sentry hosts', () => {
        const result = buildSentryReportUri({
            dsn: 'https://secretkey@sentry.mycompany.com/99'
        });

        expect(result).toBe('https://sentry.mycompany.com/api/99/security/?sentry_key=secretkey');
    });
});
