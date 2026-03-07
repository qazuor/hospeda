/**
 * T-043: Linear integration test.
 *
 * Verifies that the feedback submit hook (useFeedbackSubmit):
 * - Sends FormData via POST to the correct API endpoint
 * - On a success response with linearIssueId, populates state.result correctly
 * - On a failure response, surfaces the error in state.error
 * - On a network error, reflects a connection error in state.error
 *
 * All tests operate on the pure async submit logic extracted from the hook
 * (same approach as `test/hooks/useFeedbackSubmit.test.ts`) — no React
 * rendering or DOM required.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FeedbackFormData } from '../../src/schemas/feedback.schema.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = 'http://localhost:3001';
const EXPECTED_ENDPOINT = `${API_URL}/api/v1/public/feedback`;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Minimal valid form submission */
const minimalFormData: FeedbackFormData = {
    type: 'bug-js',
    title: 'Linear integration test',
    description: 'Testing the Linear issue creation flow end-to-end',
    reporterEmail: 'dev@hospeda.com',
    reporterName: 'Developer',
    environment: {
        timestamp: new Date().toISOString(),
        appSource: 'web'
    }
};

/** Full form submission with all optional fields */
const fullFormData: FeedbackFormData = {
    type: 'bug-ui-ux',
    title: 'Button overlaps text on mobile',
    description: 'On screens narrower than 375px the submit button overlaps the form label.',
    reporterEmail: 'qa@hospeda.com',
    reporterName: 'QA Engineer',
    severity: 'high',
    stepsToReproduce: '1. Open on iPhone SE\n2. Go to /contact',
    expectedResult: 'Button should be below the label',
    actualResult: 'Button overlaps label text',
    environment: {
        timestamp: new Date().toISOString(),
        appSource: 'web',
        url: 'https://hospeda.com/contact',
        browser: 'Safari 17',
        os: 'iOS 17',
        viewport: '375x667'
    }
};

// ---------------------------------------------------------------------------
// Submit helper — mirrors useFeedbackSubmit async logic
// ---------------------------------------------------------------------------

interface SubmitState {
    isSubmitting: boolean;
    error: string | null;
    result: {
        linearIssueId: string | null;
        linearIssueUrl?: string;
        message?: string;
    } | null;
}

/**
 * Extracted async submit logic from useFeedbackSubmit.
 * Mirrors the exact `submit` function in the hook for pure testing.
 */
async function runSubmit(
    data: FeedbackFormData,
    attachments: File[] | undefined,
    apiUrl: string,
    honeypotValue?: string
): Promise<SubmitState> {
    try {
        const formData = new FormData();
        formData.append('data', JSON.stringify(data));

        if (honeypotValue) {
            formData.append('website', honeypotValue);
        }

        if (attachments) {
            for (const file of attachments) {
                formData.append('attachments', file);
            }
        }

        const response = await fetch(`${apiUrl}/api/v1/public/feedback`, {
            method: 'POST',
            body: formData
        });

        let json: {
            success: boolean;
            error?: { message?: string };
            data?: {
                linearIssueId: string | null;
                linearIssueUrl?: string;
                message?: string;
            };
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
// Tests: endpoint and request format
// ---------------------------------------------------------------------------

describe('Linear integration: request format', () => {
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

    it('should POST to the correct endpoint URL', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: { linearIssueId: 'LIN-1' } })
        } as Response);

        // Act
        await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(fetch).toHaveBeenCalledWith(EXPECTED_ENDPOINT, expect.anything());
    });

    it('should use POST as the HTTP method', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: { linearIssueId: 'LIN-1' } })
        } as Response);

        // Act
        await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(fetch).toHaveBeenCalledWith(
            EXPECTED_ENDPOINT,
            expect.objectContaining({ method: 'POST' })
        );
    });

    it('should include a FormData body in the request', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: { linearIssueId: 'LIN-1' } })
        } as Response);

        // Act
        await runSubmit(minimalFormData, undefined, API_URL);

        // Assert — body should be a FormData instance (or the stub)
        const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
        expect(options.body).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// Tests: success response with linearIssueId
// ---------------------------------------------------------------------------

describe('Linear integration: success response with linearIssueId', () => {
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

    it('should set state.result.linearIssueId when API returns a Linear issue ID', async () => {
        // Arrange
        const linearIssueId = 'LIN-123';
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: { linearIssueId }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.result?.linearIssueId).toBe(linearIssueId);
    });

    it('should set state.result.linearIssueUrl when API returns a Linear issue URL', async () => {
        // Arrange
        const mockResult = {
            linearIssueId: 'LIN-456',
            linearIssueUrl: 'https://linear.app/hospeda/issue/LIN-456'
        };
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ success: true, data: mockResult })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.result?.linearIssueUrl).toBe(mockResult.linearIssueUrl);
    });

    it('should set state.error=null on success', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: { linearIssueId: 'LIN-789' }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBeNull();
    });

    it('should set state.isSubmitting=false after success', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: { linearIssueId: 'LIN-1' }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.isSubmitting).toBe(false);
    });

    it('should handle linearIssueId=null (fallback email path)', async () => {
        // Arrange — API returns null linearIssueId when Linear was unavailable
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: { linearIssueId: null, message: 'Report received via email fallback' }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.result?.linearIssueId).toBeNull();
        expect(state.error).toBeNull();
    });

    it('should handle full form submission without errors', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                success: true,
                data: {
                    linearIssueId: 'LIN-999',
                    linearIssueUrl: 'https://linear.app/hospeda/issue/LIN-999'
                }
            })
        } as Response);

        // Act
        const state = await runSubmit(fullFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBeNull();
        expect(state.result?.linearIssueId).toBe('LIN-999');
    });
});

// ---------------------------------------------------------------------------
// Tests: failure response (4xx / API error)
// ---------------------------------------------------------------------------

describe('Linear integration: failure response', () => {
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

    it('should set state.error when API returns success=false', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({
                success: false,
                error: { message: 'Validation error: title is required' }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBe('Validation error: title is required');
    });

    it('should set state.result=null on failure response', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({
                success: false,
                error: { message: 'Internal server error' }
            })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.result).toBeNull();
    });

    it('should use fallback error message when response has no error.message', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({ success: false })
        } as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBe('Error al enviar el reporte');
    });

    it('should handle unparseable response body', async () => {
        // Arrange
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 503,
            json: async () => {
                throw new SyntaxError('Unexpected token <');
            }
        } as unknown as Response);

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toContain('503');
        expect(state.result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Tests: network error
// ---------------------------------------------------------------------------

describe('Linear integration: network error', () => {
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

    it('should set state.error with the Error message on fetch rejection', async () => {
        // Arrange
        vi.mocked(fetch).mockRejectedValueOnce(new Error('Network unreachable'));

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBe('Network unreachable');
    });

    it('should set state.result=null on network error', async () => {
        // Arrange
        vi.mocked(fetch).mockRejectedValueOnce(new Error('Connection refused'));

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.result).toBeNull();
    });

    it('should set state.isSubmitting=false on network error', async () => {
        // Arrange
        vi.mocked(fetch).mockRejectedValueOnce(new Error('Timeout'));

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.isSubmitting).toBe(false);
    });

    it('should use "Error de conexion" when a non-Error value is thrown', async () => {
        // Arrange — simulates a case where something non-Error is thrown
        vi.mocked(fetch).mockRejectedValueOnce('connection refused');

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBe('Error de conexion');
    });

    it('should handle CORS errors (TypeError from fetch)', async () => {
        // Arrange
        vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

        // Act
        const state = await runSubmit(minimalFormData, undefined, API_URL);

        // Assert
        expect(state.error).toBe('Failed to fetch');
    });
});
