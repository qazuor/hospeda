/**
 * @file sentry-privacy.test.ts
 * @description Pins the Sentry v11 privacy policy for the web app (HOS-1892).
 */

import { describe, expect, it } from 'vitest';
import {
    SENTRY_DATA_COLLECTION,
    scrubSentryEvent
} from '../../../src/lib/observability/sentry-privacy';

const asEvent = <T extends Record<string, unknown>>(value: T): T => value;

describe('SENTRY_DATA_COLLECTION', () => {
    it('collects no cookies, bodies, user info or DB/queue data', () => {
        expect(SENTRY_DATA_COLLECTION.cookies).toBe(false);
        expect(SENTRY_DATA_COLLECTION.userInfo).toBe(false);
        expect(SENTRY_DATA_COLLECTION.httpBodies).toEqual([]);
        expect(SENTRY_DATA_COLLECTION.databaseQueryData).toBe(false);
        expect(SENTRY_DATA_COLLECTION.queues).toBe(false);
        expect(SENTRY_DATA_COLLECTION.genAI).toEqual({ inputs: false, outputs: false });
    });

    it('collects no URL query params at all', () => {
        expect(SENTRY_DATA_COLLECTION.urlQueryParams).toEqual({ allow: [] });
    });

    it('denies auth and cookie headers in both directions', () => {
        const { request, response } = SENTRY_DATA_COLLECTION.httpHeaders;
        for (const name of ['authorization', 'cookie', 'token', 'api-key']) {
            expect(request.deny).toContain(name);
            expect(response.deny).toContain(name);
        }
        expect(response.deny).toContain('set-cookie');
    });
});

describe('scrubSentryEvent', () => {
    it('strips query_string, query and fragment from the request url', () => {
        const result = scrubSentryEvent(
            asEvent({
                request: {
                    url: 'https://hospeda.com.ar/es/auth/callback?code=abc&state=x#frag',
                    query_string: 'code=abc&state=x'
                }
            })
        );

        expect(result.request).toEqual({ url: 'https://hospeda.com.ar/es/auth/callback' });
    });

    it('removes credential headers regardless of casing and keeps the rest', () => {
        const result = scrubSentryEvent(
            asEvent({
                request: {
                    url: 'https://hospeda.com.ar/',
                    headers: {
                        Authorization: 'Bearer x',
                        cookie: 'sid=1',
                        'X-Auth-Token': 't',
                        'user-agent': 'ua'
                    }
                }
            })
        );

        expect(result.request?.headers).toEqual({ 'user-agent': 'ua' });
    });

    it('leaves events without a request untouched', () => {
        const event = asEvent({ message: 'boom' });

        expect(scrubSentryEvent(event)).toEqual({ message: 'boom' });
    });
});
