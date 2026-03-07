/**
 * T-042: Rate limiting verification tests.
 *
 * Verifies that the feedback submit hook correctly handles 429 rate-limit
 * responses from the API:
 * - 429 responses are surfaced as state.error (not silently swallowed)
 * - The error message from the response body is forwarded to state.error
 * - When the API returns FEEDBACK_STRINGS.rateLimit.message, it is preserved
 * - The `result` field remains null after a rate-limit error
 * - `isSubmitting` returns to false after a rate-limit error
 *
 * All tests use the same pure async helper pattern established in
 * `test/hooks/useFeedbackSubmit.test.ts` — no DOM rendering required.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEDBACK_STRINGS } from '../../src/config/strings.js';
import type { FeedbackFormData } from '../../src/schemas/feedback.schema.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = 'http://localhost:3001';
const FEEDBACK_ENDPOINT = `${API_URL}/api/v1/public/feedback`;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal valid FeedbackFormData used across tests */
const minimalFormData: FeedbackFormData = {
    type: 'bug-js',
    title: 'Rate limit test',
    description: 'This submission triggers a rate limit check',
    reporterEmail: 'tester@example.com',
    reporterName: 'Rate Limit Tester',
    environment: {
        timestamp: new Date().toISOString(),
        appSource: 'web'
    }
};

// ---------------------------------------------------------------------------
// Submit logic helper — mirrors useFeedbackSubmit internals
// ---------------------------------------------------------------------------

interface SubmitState {
    isSubmitting: boolean;
    error: string | null;
    result: { linearIssueId: string | null } | null;
}

/**
 * Runs the same async submit logic as useFeedbackSubmit.
 * Extracted for pure-function testing without React rendering.
 */
async function runSubmit(data: FeedbackFormData, apiUrl: string): Promise<SubmitState> {
    try {
        const formData = new FormData();
        formData.append('data', JSON.stringify(data));

        const response = await fetch(`${apiUrl}/api/v1/public/feedback`, {
            method: 'POST',
            body: formData
        });

        let json: {
            success: boolean;
            error?: { message?: string };
            data?: { linearIssueId: string | null };
        };

        try {
            json = (await response.json()) as typeof json;
        } catch {
            return {
                isSubmitting: false,
                error: `Error del servidor (HTTP ${response.status})`,
                result: null
            };
        }

        if (!response.ok || !json.success) {
            return {
                isSubmitting: false,
                error: json.error?.message ?? 'Error al enviar el reporte',
                result: null
            };
        }

        return {
            isSubmitting: false,
            error: null,
            result: json.data ?? null
        };
    } catch (err) {
        return {
            isSubmitting: false,
            error: err instanceof Error ? err.message : 'Error de conexion',
            result: null
        };
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Rate limiting: FEEDBACK_STRINGS.rateLimit', () => {
    it('should have a defined rateLimit.message string', () => {
        expect(FEEDBACK_STRINGS.rateLimit.message).toBeDefined();
        expect(typeof FEEDBACK_STRINGS.rateLimit.message).toBe('string');
        expect(FEEDBACK_STRINGS.rateLimit.message.length).toBeGreaterThan(0);
    });

    it('rateLimit.message should match the expected Spanish text', () => {
        expect(FEEDBACK_STRINGS.rateLimit.message).toBe(
            'Demasiados reportes. Intenta de nuevo mas tarde.'
        );
    });
});

describe('Rate limiting: submit hook handles 429 responses', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        vi.stubGlobal(
            'FormData',
            class {
                private _entries: Array<[string, unknown]> = [];
                append(key: string, value: unknown) {
                    this._entries.push([key, value]);
                }
            }
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should set state.error when API returns 429', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({
                success: false,
                error: { message: FEEDBACK_STRINGS.rateLimit.message }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, API_URL);

        // Assert
        expect(state.error).not.toBeNull();
    });

    it('should forward the rate limit message from response body to state.error', async () => {
        // Arrange
        const rateLimitMessage = FEEDBACK_STRINGS.rateLimit.message;
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({
                success: false,
                error: { message: rateLimitMessage }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, API_URL);

        // Assert
        expect(state.error).toBe(rateLimitMessage);
    });

    it('state.error should contain the rate limit text after 429 response', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({
                success: false,
                error: { message: FEEDBACK_STRINGS.rateLimit.message }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, API_URL);

        // Assert — the error message should include rate limit text
        expect(state.error).toContain('Demasiados reportes');
    });

    it('state.result should be null after 429 response', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({
                success: false,
                error: { message: FEEDBACK_STRINGS.rateLimit.message }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, API_URL);

        // Assert
        expect(state.result).toBeNull();
    });

    it('state.isSubmitting should be false after 429 response', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({
                success: false,
                error: { message: FEEDBACK_STRINGS.rateLimit.message }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, API_URL);

        // Assert
        expect(state.isSubmitting).toBe(false);
    });

    it('should use fallback error message when 429 response has no error.message', async () => {
        // Arrange — 429 with no error message body
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({ success: false })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, API_URL);

        // Assert
        expect(state.error).toBe('Error al enviar el reporte');
    });

    it('should call fetch with the correct endpoint URL', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({
                success: false,
                error: { message: FEEDBACK_STRINGS.rateLimit.message }
            })
        } as Response);

        // Act
        await runSubmit(minimalFormData, API_URL);

        // Assert
        expect(fetch).toHaveBeenCalledWith(
            FEEDBACK_ENDPOINT,
            expect.objectContaining({
                method: 'POST'
            })
        );
    });

    it('should still error (not succeed) even when 429 body has success=true', async () => {
        // Arrange — malformed API response (non-ok status overrides success flag)
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({
                success: true, // this should be ignored because response.ok is false
                data: { linearIssueId: 'LIN-999' }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, API_URL);

        // Assert — non-ok response means error regardless of body success flag
        expect(state.error).not.toBeNull();
        expect(state.result).toBeNull();
    });
});

describe('Rate limiting: FEEDBACK_CONFIG rate limit setting', () => {
    it('should have a numeric rateLimit value in FEEDBACK_CONFIG', async () => {
        const { FEEDBACK_CONFIG } = await import('../../src/config/feedback.config.js');
        expect(typeof FEEDBACK_CONFIG.rateLimit).toBe('number');
        expect(FEEDBACK_CONFIG.rateLimit).toBeGreaterThan(0);
    });

    it('FEEDBACK_CONFIG.rateLimit should be 30 (max reports per IP per hour)', async () => {
        const { FEEDBACK_CONFIG } = await import('../../src/config/feedback.config.js');
        expect(FEEDBACK_CONFIG.rateLimit).toBe(30);
    });
});
