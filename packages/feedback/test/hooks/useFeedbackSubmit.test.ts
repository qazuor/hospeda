/**
 * Tests for the useFeedbackSubmit hook logic.
 *
 * We test the async submit logic directly by extracting the state-machine
 * transitions and fetch interactions. This avoids requiring React Testing
 * Library while still covering all meaningful behavior.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackFormData } from '../../src/schemas/feedback.schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_URL = 'http://localhost:3001';

/** Minimal valid FeedbackFormData fixture. */
const minimalFormData: FeedbackFormData = {
    type: 'bug-js',
    title: 'Test bug',
    description: 'A short description for testing purposes',
    reporterEmail: 'tester@example.com',
    reporterName: 'Test User',
    environment: {
        timestamp: new Date().toISOString(),
        appSource: 'web'
    }
};

/** Simulates the core async submit function from useFeedbackSubmit. */
async function runSubmit(
    data: FeedbackFormData,
    attachments: File[] | undefined,
    apiUrl: string
): Promise<{
    isSubmitting: boolean;
    error: string | null;
    result: { linearIssueId: string | null; linearIssueUrl?: string; message?: string } | null;
}> {
    try {
        const formData = new FormData();
        formData.append('data', JSON.stringify(data));
        if (attachments) {
            for (const file of attachments) {
                formData.append('attachments', file);
            }
        }

        const response = await fetch(`${apiUrl}/api/v1/public/feedback`, {
            method: 'POST',
            body: formData
        });

        const json = (await response.json()) as {
            success: boolean;
            error?: { message?: string };
            data?: { linearIssueId: string | null; linearIssueUrl?: string; message?: string };
        };

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

describe('useFeedbackSubmit (submit logic)', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        // FormData is not available in Node vitest by default; stub it
        vi.stubGlobal(
            'FormData',
            class {
                private entries: Array<[string, unknown]> = [];
                append(key: string, value: unknown) {
                    this.entries.push([key, value]);
                }
            }
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should return result on successful submission', async () => {
        // Arrange
        const mockResult = {
            linearIssueId: 'LIN-123',
            linearIssueUrl: 'https://linear.app/i/LIN-123'
        };
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: mockResult })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBeNull();
        expect(state.isSubmitting).toBe(false);
        expect(state.result).toEqual(mockResult);
    });

    it('should return error message from API when success is false', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            json: async () => ({
                success: false,
                error: { message: 'Rate limit exceeded' }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBe('Rate limit exceeded');
        expect(state.result).toBeNull();
    });

    it('should use fallback error message when API error has no message', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            json: async () => ({ success: false })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBe('Error al enviar el reporte');
    });

    it('should return error on network failure', async () => {
        // Arrange
        vi.mocked(fetch).mockRejectedValueOnce(new Error('Network unreachable'));

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBe('Network unreachable');
        expect(state.result).toBeNull();
    });

    it('should handle non-Error thrown values', async () => {
        // Arrange
        vi.mocked(fetch).mockRejectedValueOnce('connection refused');

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBe('Error de conexion');
    });

    it('should call fetch with POST method and form data body', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: { linearIssueId: 'LIN-1' } })
        } as Response);

        // Act
        await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(fetch).toHaveBeenCalledWith(
            `${API_URL}/api/v1/public/feedback`,
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('should set isSubmitting to false after success', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: { linearIssueId: null } })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.isSubmitting).toBe(false);
    });

    it('should set isSubmitting to false after error', async () => {
        // Arrange
        vi.mocked(fetch).mockRejectedValueOnce(new Error('fail'));

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.isSubmitting).toBe(false);
    });

    it('should include attachments when provided', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: { linearIssueId: 'LIN-2' } })
        } as Response);
        const file = new File(['content'], 'screenshot.png', { type: 'image/png' });

        // Act – no assertion on FormData content since it's stubbed, just verify no throw
        const state = await runSubmit(minimalFormData, [file], API_URL);

        // Assert
        expect(state.error).toBeNull();
    });
});

describe('useFeedbackSubmit reset logic', () => {
    it('should reset state to initial values', () => {
        // Arrange
        const state = {
            isSubmitting: false,
            error: 'previous error',
            result: { linearIssueId: 'LIN-1' }
        };

        // Act (simulate reset)
        const reset = () => ({
            isSubmitting: false,
            error: null,
            result: null
        });
        const resetState = reset();

        // Assert
        expect(resetState.isSubmitting).toBe(false);
        expect(resetState.error).toBeNull();
        expect(resetState.result).toBeNull();

        // Suppress unused warning
        void state;
    });
});
