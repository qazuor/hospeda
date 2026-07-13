/**
 * Google Calendar REST Client Tests (HOS-157 Phase 2 — Layer 3)
 *
 * Unit tests for `listEvents`.
 *
 * Mocked collaborators:
 * - `global.fetch` — outbound HTTP call to the Calendar API events.list endpoint.
 *
 * Scenarios covered (AAA pattern):
 * 1. Full sync: sends singleEvents=true + timeMin, no syncToken; Bearer header;
 *    calendarId URL-encoded; maps items + nextSyncToken.
 * 2. Incremental sync: sends syncToken, NOT timeMin; maps nextPageToken.
 * 3. Pagination: pageToken is forwarded.
 * 4. 410 with reason=fullSyncRequired → GoogleCalendarSyncTokenInvalidError.
 * 5. 410 without that reason → GoogleCalendarApiError(410).
 * 6. 5xx → GoogleCalendarApiError with status.
 *
 * @module test/services/google-calendar/google-calendar-client
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));

describe('google-calendar-client', () => {
    let listEvents: typeof import('../../../src/services/google-calendar/google-calendar-client.js').listEvents;
    let GoogleCalendarSyncTokenInvalidError: typeof import('../../../src/services/google-calendar/google-calendar-client.js').GoogleCalendarSyncTokenInvalidError;
    let GoogleCalendarApiError: typeof import('../../../src/services/google-calendar/google-calendar-client.js').GoogleCalendarApiError;

    beforeEach(async () => {
        vi.clearAllMocks();
        global.fetch = mockFetch;
        ({ listEvents, GoogleCalendarSyncTokenInvalidError, GoogleCalendarApiError } = await import(
            '../../../src/services/google-calendar/google-calendar-client.js'
        ));
    });

    const jsonResponse = (
        body: unknown,
        init?: { status?: number; ok?: boolean }
    ): Partial<Response> => ({
        ok: init?.ok ?? true,
        status: init?.status ?? 200,
        json: () => Promise.resolve(body),
        text: () => Promise.resolve(JSON.stringify(body))
    });

    it('should send a full-sync request with singleEvents + timeMin and no syncToken', async () => {
        // Arrange
        mockFetch.mockResolvedValue(
            jsonResponse({
                items: [{ id: 'ev-1', status: 'confirmed' }],
                nextSyncToken: 'sync-1'
            })
        );

        // Act
        const result = await listEvents({
            accessToken: 'ya29.token',
            calendarId: 'primary',
            timeMin: '2026-07-01T00:00:00.000Z'
        });

        // Assert
        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [url, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('https://www.googleapis.com/calendar/v3/calendars/primary/events?');
        const parsed = new URL(url);
        expect(parsed.searchParams.get('singleEvents')).toBe('true');
        expect(parsed.searchParams.get('timeMin')).toBe('2026-07-01T00:00:00.000Z');
        expect(parsed.searchParams.get('syncToken')).toBeNull();
        expect(requestInit.headers).toMatchObject({ Authorization: 'Bearer ya29.token' });

        expect(result.items).toEqual([{ id: 'ev-1', status: 'confirmed' }]);
        expect(result.nextSyncToken).toBe('sync-1');
        expect(result.nextPageToken).toBeUndefined();
    });

    it('should send an incremental request with syncToken and NOT timeMin', async () => {
        // Arrange
        mockFetch.mockResolvedValue(jsonResponse({ items: [], nextPageToken: 'page-2' }));

        // Act
        const result = await listEvents({
            accessToken: 'ya29.token',
            calendarId: 'primary',
            syncToken: 'stored-sync',
            timeMin: '2026-07-01T00:00:00.000Z' // must be ignored when syncToken is present
        });

        // Assert
        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        const parsed = new URL(url);
        expect(parsed.searchParams.get('syncToken')).toBe('stored-sync');
        expect(parsed.searchParams.get('timeMin')).toBeNull();
        expect(result.nextPageToken).toBe('page-2');
    });

    it('should forward the timeZone param when provided', async () => {
        // Arrange
        mockFetch.mockResolvedValue(jsonResponse({ items: [] }));

        // Act
        await listEvents({
            accessToken: 'ya29.token',
            calendarId: 'primary',
            syncToken: 's',
            timeZone: 'America/Argentina/Buenos_Aires'
        });

        // Assert
        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(new URL(url).searchParams.get('timeZone')).toBe('America/Argentina/Buenos_Aires');
    });

    it('should NOT send a timeZone param when omitted', async () => {
        // Arrange
        mockFetch.mockResolvedValue(jsonResponse({ items: [] }));

        // Act
        await listEvents({ accessToken: 'ya29.token', calendarId: 'primary', timeMin: 'x' });

        // Assert
        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(new URL(url).searchParams.get('timeZone')).toBeNull();
    });

    it('should URL-encode a non-primary calendar id and forward the pageToken', async () => {
        // Arrange
        mockFetch.mockResolvedValue(jsonResponse({ items: [] }));

        // Act
        await listEvents({
            accessToken: 'ya29.token',
            calendarId: 'host@group.calendar.google.com',
            syncToken: 's',
            pageToken: 'cursor-1'
        });

        // Assert
        const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
        expect(url).toContain('host%40group.calendar.google.com');
        expect(new URL(url).searchParams.get('pageToken')).toBe('cursor-1');
    });

    it('should throw GoogleCalendarSyncTokenInvalidError on 410 fullSyncRequired', async () => {
        // Arrange
        mockFetch.mockResolvedValue(
            jsonResponse(
                {
                    error: {
                        errors: [{ reason: 'fullSyncRequired' }],
                        code: 410,
                        message: 'Sync token is no longer valid, a full sync is required.'
                    }
                },
                { ok: false, status: 410 }
            )
        );

        // Act & Assert
        await expect(
            listEvents({ accessToken: 't', calendarId: 'primary', syncToken: 'stale' })
        ).rejects.toBeInstanceOf(GoogleCalendarSyncTokenInvalidError);
    });

    it('should treat a bare 410 (no parseable body) as a stale sync token', async () => {
        // Arrange
        mockFetch.mockResolvedValue({
            ok: false,
            status: 410,
            json: () => Promise.resolve(undefined),
            text: () => Promise.resolve('')
        } as Partial<Response>);

        // Act & Assert
        await expect(
            listEvents({ accessToken: 't', calendarId: 'primary', syncToken: 'stale' })
        ).rejects.toBeInstanceOf(GoogleCalendarSyncTokenInvalidError);
    });

    it('should throw GoogleCalendarApiError on a 5xx response', async () => {
        // Arrange
        mockFetch.mockResolvedValue(
            jsonResponse({ error: { message: 'backend error' } }, { ok: false, status: 503 })
        );

        // Act & Assert
        await expect(
            listEvents({ accessToken: 't', calendarId: 'primary', timeMin: 'x' })
        ).rejects.toMatchObject({ name: 'GoogleCalendarApiError', status: 503 });
    });

    it('should throw GoogleCalendarApiError on a 401 response', async () => {
        // Arrange
        mockFetch.mockResolvedValue(
            jsonResponse({ error: { message: 'invalid credentials' } }, { ok: false, status: 401 })
        );

        // Act & Assert
        await expect(
            listEvents({ accessToken: 'bad', calendarId: 'primary', timeMin: 'x' })
        ).rejects.toBeInstanceOf(GoogleCalendarApiError);
    });
});
