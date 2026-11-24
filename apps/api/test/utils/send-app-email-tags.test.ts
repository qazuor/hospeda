/**
 * @file send-app-email-tags.test.ts
 * @description HOS-2583: the second Brevo send path (`sendAppEmail` -> `sendEmail`) tags
 * the send with its template key. Reads `body.tags` from the mocked `fetch`, so a dropped
 * tag turns it red. Auth, conversation mailer and the conversation crons all use this path.
 */
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/utils/env', () => ({ env: {} }));

const { sendAppEmail } = await import('../../src/utils/email-sender');

const fetchMock = vi.fn();

describe('sendAppEmail template tag', () => {
    beforeEach(() => {
        fetchMock.mockReset();
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ messageId: '<m@brevo>' }), { status: 201 })
        );
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        'auth.reset-password',
        'auth.verify-email',
        'conversation.verify',
        'conversation.token-expiring-day15'
    ] as const)('sends template:%s in the Brevo body', async (templateKey) => {
        await sendAppEmail({
            client: { apiKey: 'k', baseUrl: 'https://brevo.test/v3' },
            to: 'user@example.com',
            subject: 'Hola',
            react: createElement('p', null, 'hola'),
            attribution: { medium: 'transactional', templateKey }
        });

        const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string);
        expect(body.tags).toEqual([`template:${templateKey}`]);
    });
});
