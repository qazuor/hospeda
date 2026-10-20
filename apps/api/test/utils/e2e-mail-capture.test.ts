import { describe, expect, it } from 'vitest';
import {
    assertMailCaptureIsLocal,
    resolveOutboxEmailClientConfig
} from '../../src/utils/e2e-mail-capture';

describe('TEST:V4:23 support - the e2e mail capture is local only', () => {
    it('allows omitted capture and local site/capture hosts', () => {
        expect(() =>
            assertMailCaptureIsLocal({ captureUrl: undefined, siteUrl: 'https://hospeda.com.ar' })
        ).not.toThrow();
        expect(() =>
            assertMailCaptureIsLocal({
                captureUrl: 'http://localhost:18091',
                siteUrl: 'http://127.0.0.1:4321'
            })
        ).not.toThrow();
        expect(() =>
            assertMailCaptureIsLocal({
                captureUrl: 'http://127.0.0.1:18091',
                siteUrl: 'http://localhost:4321'
            })
        ).not.toThrow();
    });

    it('rejects a remote site or a remote capture server', () => {
        expect(() =>
            assertMailCaptureIsLocal({
                captureUrl: 'http://127.0.0.1:18091',
                siteUrl: 'https://hospeda.com.ar'
            })
        ).toThrow(
            'HOSPEDA_E2E_MAIL_CAPTURE_URL is only allowed when HOSPEDA_SITE_URL and the capture URL use localhost or 127.0.0.1'
        );
        expect(() =>
            assertMailCaptureIsLocal({
                captureUrl: 'https://api.brevo.com',
                siteUrl: 'http://localhost:4321'
            })
        ).toThrow(
            'HOSPEDA_E2E_MAIL_CAPTURE_URL is only allowed when HOSPEDA_SITE_URL and the capture URL use localhost or 127.0.0.1'
        );
    });

    it('resolves each API key and capture URL combination', () => {
        expect(
            resolveOutboxEmailClientConfig({ apiKey: undefined, captureUrl: undefined })
        ).toBeNull();
        expect(
            resolveOutboxEmailClientConfig({ apiKey: 'provider-key', captureUrl: undefined })
        ).toEqual({ apiKey: 'provider-key' });
        expect(
            resolveOutboxEmailClientConfig({
                apiKey: undefined,
                captureUrl: 'http://127.0.0.1:18091'
            })
        ).toEqual({ apiKey: 'e2e-mail-capture', baseUrl: 'http://127.0.0.1:18091' });
        expect(
            resolveOutboxEmailClientConfig({
                apiKey: 'provider-key',
                captureUrl: 'http://127.0.0.1:18091'
            })
        ).toEqual({ apiKey: 'provider-key', baseUrl: 'http://127.0.0.1:18091' });
    });
});
