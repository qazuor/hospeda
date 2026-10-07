/**
 * TEST:U2:13 (HOS-1627, AC:U2:12) — a synchronous hard bounce from Brevo's
 * `POST /smtp/email` makes `BrevoEmailTransport.send` throw
 * `EmailHardBounceError`; every other refusal stays a plain, retryable error.
 *
 * Mutation: removing the translation to `EmailHardBounceError` in the
 * transport turns the first case red.
 */

import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-email/render', () => ({
    render: vi.fn().mockResolvedValue('<html><body>rendered</body></html>')
}));

import type { EmailClient } from '../../src/config/resend.config';
import { EmailHardBounceError } from '../../src/services/outbox/email-outbox-delivery.service';
import {
    BrevoEmailTransport,
    isBrevoSynchronousHardBounce
} from '../../src/transports/email/resend-transport';

const TEST_CLIENT: EmailClient = {
    apiKey: 'xkeysib-test',
    baseUrl: 'https://api.test.example/v3'
};

const OPTIONS = { fromEmail: 'noreply@example.com', fromName: 'Hospeda' } as const;

function errorResponse(status: number, body: unknown): Response {
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

async function sendWith(response: Response | Error): Promise<unknown> {
    const fetchMock = vi.fn();
    if (response instanceof Error) {
        fetchMock.mockRejectedValue(response);
    } else {
        fetchMock.mockResolvedValue(response);
    }
    vi.stubGlobal('fetch', fetchMock);
    const transport = new BrevoEmailTransport(TEST_CLIENT, OPTIONS);
    try {
        await transport.send({ to: 'bad@example', subject: 's', react: {} as ReactElement });
    } catch (error) {
        return error;
    }
    throw new Error('send did not reject');
}

describe('TEST:U2:13 BrevoEmailTransport maps a synchronous hard bounce to EmailHardBounceError', () => {
    beforeEach(() => {
        vi.unstubAllGlobals();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('throws EmailHardBounceError when Brevo refuses the recipient address', async () => {
        // Arrange
        const response = errorResponse(400, {
            code: 'invalid_parameter',
            message: 'email is not valid in to'
        });

        // Act
        const error = await sendWith(response);

        // Assert
        expect(error).toBeInstanceOf(EmailHardBounceError);
        expect((error as Error).message).toContain('email is not valid in to');
    });

    it.each([
        [
            'another invalid_parameter 400',
            400,
            { code: 'invalid_parameter', message: 'sender is invalid' }
        ],
        [
            'a missing_parameter 400',
            400,
            { code: 'missing_parameter', message: 'subject is missing' }
        ],
        [
            'the recipient message with another code',
            400,
            { code: 'bad_request', message: 'email is not valid in to' }
        ],
        [
            'the recipient message with another status',
            422,
            { code: 'invalid_parameter', message: 'email is not valid in to' }
        ],
        ['an unauthorized key', 401, { code: 'unauthorized', message: 'Key not found' }],
        ['rate limiting', 429, { code: 'too_many_requests', message: 'slow down' }],
        ['a provider outage', 503, 'not json']
    ])('keeps %s a generic retryable error', async (_label, status, body) => {
        // Act
        const error = await sendWith(errorResponse(status, body));

        // Assert
        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(EmailHardBounceError);
        expect((error as Error).message).toMatch(/^Failed to send email via Brevo: /);
    });

    it('keeps a network failure a generic retryable error', async () => {
        // Act
        const error = await sendWith(new TypeError('fetch failed'));

        // Assert
        expect(error).not.toBeInstanceOf(EmailHardBounceError);
        expect((error as Error).message).toBe('Failed to send email via Brevo: fetch failed');
    });

    it('the predicate matches the recipient refusal only', () => {
        // Assert
        expect(
            isBrevoSynchronousHardBounce({
                status: 400,
                code: 'invalid_parameter',
                message: 'Email is not valid in to'
            })
        ).toBe(true);
        expect(
            isBrevoSynchronousHardBounce({ status: 400, code: 'invalid_parameter', message: null })
        ).toBe(false);
        expect(
            isBrevoSynchronousHardBounce({
                status: 400,
                code: 'invalid_parameter',
                message: 'email is not valid in cc'
            })
        ).toBe(false);
    });
});
