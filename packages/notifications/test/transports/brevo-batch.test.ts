/**
 * @file brevo-batch.test.ts
 *
 * Unit tests for `sendBatch` in brevo-batch.ts (SPEC-101 T-101-16).
 *
 * `fetch` is stubbed via `vi.stubGlobal('fetch', ...)` so no real network calls
 * are made. Tests verify:
 * - 2xx with `messageId` string (single-recipient response normalisation)
 * - 2xx with `messageIds` array (multi-recipient response normalisation)
 * - 4xx Brevo error → throws with error body included
 * - 5xx Brevo error → throws with status info
 * - Network failure → propagated throw
 * - Request body shape (messageVersions, api-key header, trackOpens/trackClicks)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendBatch } from '../../src/transports/email/brevo-batch.js';
import type {
    BrevoBatchPayload,
    BrevoBatchRecipient
} from '../../src/transports/email/brevo-batch.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal BrevoBatchPayload for tests. */
function makePayload(
    recipients: BrevoBatchRecipient[],
    overrides: Partial<BrevoBatchPayload> = {}
): BrevoBatchPayload {
    return {
        sender: { email: 'noreply@hospeda.com.ar', name: 'Hospeda' },
        subject: 'Test Subject',
        htmlContent: '<p>Default body</p>',
        messageVersions: recipients,
        ...overrides
    };
}

/** Creates a `Response`-like object that satisfies `fetch`'s return type. */
function makeResponse(
    status: number,
    body: unknown,
    ok: boolean = status >= 200 && status < 300
): Response {
    return {
        ok,
        status,
        statusText: ok ? 'OK' : 'Error',
        json: vi.fn(async () => body)
    } as unknown as Response;
}

const TEST_API_KEY = 'xkeysib-test-key';

/** Minimal single recipient entry. */
const RECIPIENT_1: BrevoBatchRecipient = {
    to: { email: 'user1@example.com', name: 'User 1' },
    subject: 'Subject 1',
    htmlContent: '<p>Body 1</p>'
};

const RECIPIENT_2: BrevoBatchRecipient = {
    to: { email: 'user2@example.com', name: 'User 2' },
    subject: 'Subject 2',
    htmlContent: '<p>Body 2</p>'
};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.clearAllMocks();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ===========================================================================
// Happy path — single messageId string (single recipient or Brevo quirk)
// ===========================================================================

describe('sendBatch — 2xx with messageId string', () => {
    it('should normalise single messageId into the first outcome', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => makeResponse(201, { messageId: 'brevo-abc-001' }))
        );

        const result = await sendBatch({
            payload: makePayload([RECIPIENT_1]),
            apiKey: TEST_API_KEY
        });

        expect(result.statusCode).toBe(201);
        expect(result.messageIds).toHaveLength(1);
        expect(result.messageIds[0]?.email).toBe('user1@example.com');
        expect(result.messageIds[0]?.messageId).toBe('brevo-abc-001');
    });
});

// ===========================================================================
// Happy path — messageIds array (multi-recipient)
// ===========================================================================

describe('sendBatch — 2xx with messageIds array', () => {
    it('should map each messageId to the corresponding recipient by index', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => makeResponse(201, { messageIds: ['msg-001', 'msg-002'] }))
        );

        const result = await sendBatch({
            payload: makePayload([RECIPIENT_1, RECIPIENT_2]),
            apiKey: TEST_API_KEY
        });

        expect(result.statusCode).toBe(201);
        expect(result.messageIds).toHaveLength(2);
        expect(result.messageIds[0]?.email).toBe('user1@example.com');
        expect(result.messageIds[0]?.messageId).toBe('msg-001');
        expect(result.messageIds[1]?.email).toBe('user2@example.com');
        expect(result.messageIds[1]?.messageId).toBe('msg-002');
    });

    it('should handle 200 status as well as 201', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => makeResponse(200, { messageIds: ['msg-001'] }, true))
        );

        const result = await sendBatch({
            payload: makePayload([RECIPIENT_1]),
            apiKey: TEST_API_KEY
        });

        expect(result.statusCode).toBe(200);
        expect(result.messageIds[0]?.messageId).toBe('msg-001');
    });
});

// ===========================================================================
// Error handling — 4xx / 5xx
// ===========================================================================

describe('sendBatch — non-2xx responses', () => {
    it('should throw with Brevo error message on 400', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                makeResponse(
                    400,
                    { message: 'Missing required fields', code: 'MISSING_PARAMS' },
                    false
                )
            )
        );

        await expect(
            sendBatch({
                payload: makePayload([RECIPIENT_1]),
                apiKey: TEST_API_KEY
            })
        ).rejects.toThrow('Missing required fields');
    });

    it('should throw with status code on 401', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () =>
                makeResponse(401, { message: 'Unauthorized: invalid api-key' }, false)
            )
        );

        await expect(
            sendBatch({
                payload: makePayload([RECIPIENT_1]),
                apiKey: 'bad-key'
            })
        ).rejects.toThrow('Unauthorized');
    });

    it('should throw on 503 with fallback status text when body is not JSON', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(
                async () =>
                    ({
                        ok: false,
                        status: 503,
                        statusText: 'Service Unavailable',
                        json: vi.fn(async () => {
                            throw new Error('not JSON');
                        })
                    }) as unknown as Response
            )
        );

        await expect(
            sendBatch({
                payload: makePayload([RECIPIENT_1]),
                apiKey: TEST_API_KEY
            })
        ).rejects.toThrow('503');
    });
});

// ===========================================================================
// Network failure
// ===========================================================================

describe('sendBatch — network failure', () => {
    it('should propagate fetch rejection', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => {
                throw new Error('ECONNREFUSED');
            })
        );

        await expect(
            sendBatch({
                payload: makePayload([RECIPIENT_1]),
                apiKey: TEST_API_KEY
            })
        ).rejects.toThrow('ECONNREFUSED');
    });
});

// ===========================================================================
// Request shape
// ===========================================================================

describe('sendBatch — request shape', () => {
    it('should send api-key header (not Authorization: Bearer)', async () => {
        const fetchMock = vi.fn(async () => makeResponse(201, { messageId: 'msg-001' }));
        vi.stubGlobal('fetch', fetchMock);

        await sendBatch({
            payload: makePayload([RECIPIENT_1]),
            apiKey: TEST_API_KEY
        });

        const [_url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
        const headers = options.headers as Record<string, string>;
        expect(headers['api-key']).toBe(TEST_API_KEY);
        expect(headers.Authorization).toBeUndefined();
    });

    it('should POST to the Brevo SMTP endpoint', async () => {
        const fetchMock = vi.fn(async () => makeResponse(201, { messageId: 'msg-001' }));
        vi.stubGlobal('fetch', fetchMock);

        await sendBatch({
            payload: makePayload([RECIPIENT_1]),
            apiKey: TEST_API_KEY
        });

        const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
        expect(url).toBe('https://api.brevo.com/v3/smtp/email');
        expect((fetchMock.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    });

    it('should include messageVersions in the request body', async () => {
        const fetchMock = vi.fn(async () =>
            makeResponse(201, { messageIds: ['msg-001', 'msg-002'] })
        );
        vi.stubGlobal('fetch', fetchMock);

        await sendBatch({
            payload: makePayload([RECIPIENT_1, RECIPIENT_2]),
            apiKey: TEST_API_KEY
        });

        const rawBody = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
        const body = JSON.parse(rawBody) as { messageVersions: unknown[] };
        expect(body.messageVersions).toHaveLength(2);
    });

    it('should include headers per recipient when provided', async () => {
        const fetchMock = vi.fn(async () => makeResponse(201, { messageId: 'msg-001' }));
        vi.stubGlobal('fetch', fetchMock);

        const recipientWithHeader: BrevoBatchRecipient = {
            ...RECIPIENT_1,
            headers: { 'X-Newsletter-Delivery-Id': 'delivery-uuid-123' }
        };

        await sendBatch({
            payload: makePayload([recipientWithHeader]),
            apiKey: TEST_API_KEY
        });

        const rawBody = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
        const body = JSON.parse(rawBody) as {
            messageVersions: Array<{ headers: Record<string, string> }>;
        };
        expect(body.messageVersions[0]?.headers?.['X-Newsletter-Delivery-Id']).toBe(
            'delivery-uuid-123'
        );
    });

    it('should include tags when provided on payload', async () => {
        const fetchMock = vi.fn(async () => makeResponse(201, { messageId: 'msg-001' }));
        vi.stubGlobal('fetch', fetchMock);

        await sendBatch({
            payload: makePayload([RECIPIENT_1], { tags: ['campaign:abc'] }),
            apiKey: TEST_API_KEY
        });

        const rawBody = (fetchMock.mock.calls[0]?.[1] as RequestInit).body as string;
        const body = JSON.parse(rawBody) as { tags: string[] };
        expect(body.tags).toContain('campaign:abc');
    });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('sendBatch — edge cases', () => {
    it('should return outcomes without messageId when 2xx body has neither field', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => makeResponse(201, {}))
        );

        const result = await sendBatch({
            payload: makePayload([RECIPIENT_1]),
            apiKey: TEST_API_KEY
        });

        expect(result.messageIds).toHaveLength(1);
        expect(result.messageIds[0]?.messageId).toBeUndefined();
        expect(result.messageIds[0]?.email).toBe('user1@example.com');
    });
});
