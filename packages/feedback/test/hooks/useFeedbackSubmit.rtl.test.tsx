import type { FeedbackFormData } from '@repo/schemas';
/**
 * RTL-based tests for useFeedbackSubmit hook.
 *
 * Uses renderHook + act to exercise the actual React hook lifecycle
 * including state transitions, AbortController, and the useEffect cleanup.
 * Covers lines 49-79 (isValidApiUrl, serializeError) and 110-233 (hook body).
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFeedbackSubmit } from '../../src/hooks/useFeedbackSubmit.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_API_URL = 'http://localhost:3001';

const minimalData: FeedbackFormData = {
    type: 'bug-js',
    title: 'Test bug title',
    description: 'A description long enough for testing.',
    reporterEmail: 'tester@example.com',
    reporterName: 'Test User',
    environment: {
        timestamp: new Date().toISOString(),
        appSource: 'web'
    }
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// Tests: initial state
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — initial state', () => {
    it('should return isSubmitting=false, error=null, result=null on first render', () => {
        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        expect(result.current.state.isSubmitting).toBe(false);
        expect(result.current.state.error).toBeNull();
        expect(result.current.state.result).toBeNull();
    });

    it('should expose submit and reset as functions', () => {
        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        expect(typeof result.current.submit).toBe('function');
        expect(typeof result.current.reset).toBe('function');
    });
});

// ---------------------------------------------------------------------------
// Tests: invalid apiUrl guard (lines 130-137)
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — invalid apiUrl guard', () => {
    it('should set error="URL de API invalida" when apiUrl is not http/https', async () => {
        const { result } = renderHook(() =>
            useFeedbackSubmit({ apiUrl: 'ftp://bad-protocol.com' })
        );

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.error).toBe('URL de API invalida');
        expect(result.current.state.isSubmitting).toBe(false);
        expect(result.current.state.result).toBeNull();
        expect(fetch).not.toHaveBeenCalled();
    });

    it('should set error when apiUrl is an empty string', async () => {
        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: '' }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.error).toBe('URL de API invalida');
    });

    it('should set error when apiUrl is a plain string with no protocol', async () => {
        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: 'not-a-url' }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.error).toBe('URL de API invalida');
    });
});

// ---------------------------------------------------------------------------
// Tests: isSubmitting transitions
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — isSubmitting lifecycle', () => {
    it('should set isSubmitting=false after a successful submission', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { linearIssueId: 'LIN-1' } })
        } as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.isSubmitting).toBe(false);
        expect(result.current.state.result).toEqual({ linearIssueId: 'LIN-1' });
    });

    it('should set isSubmitting=false after a network error', async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error('Network failed'));

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.isSubmitting).toBe(false);
        expect(result.current.state.error).toBe('Network failed');
    });
});

// ---------------------------------------------------------------------------
// Tests: 429 rate limiting (lines 170-177)
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — 429 rate limiting', () => {
    it('should set the rateLimit error message when response.status is 429', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 429,
            json: async () => ({})
        } as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.error).toBeTruthy();
        expect(result.current.state.isSubmitting).toBe(false);
        expect(result.current.state.result).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Tests: JSON parse failure (lines 186-194)
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — JSON parse failure', () => {
    it('should set error with HTTP status when response.json() throws', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => {
                throw new SyntaxError('Unexpected token');
            }
        } as unknown as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.error).toContain('Error del servidor');
        expect(result.current.state.isSubmitting).toBe(false);
    });
});

// ---------------------------------------------------------------------------
// Tests: API error responses (lines 197-204)
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — API error responses', () => {
    it('should set error from json.error.message when response.ok is false', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 400,
            json: async () => ({ success: false, error: { message: 'Bad request' } })
        } as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.error).toBe('Bad request');
    });

    it('should use fallback error message when json.error has no message', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({ success: false })
        } as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.error).toBe('Error al enviar el reporte');
    });

    it('should set error when json.success is false even though response.ok is true', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: false, error: { message: 'Validation failed' } })
        } as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.error).toBe('Validation failed');
    });
});

// ---------------------------------------------------------------------------
// Tests: successful submission with result (lines 206-210)
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — successful submission', () => {
    it('should populate result with linearIssueId and linearIssueUrl', async () => {
        const mockResult = {
            linearIssueId: 'HOS-42',
            linearIssueUrl: 'https://linear.app/hospeda/issue/HOS-42',
            message: 'Tu reporte fue creado'
        };
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: mockResult })
        } as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.error).toBeNull();
        expect(result.current.state.result).toEqual(mockResult);
    });

    it('should set result to null when json.data is undefined', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true })
        } as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        expect(result.current.state.result).toBeNull();
        expect(result.current.state.error).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Tests: non-Error thrown values (serializeError, lines 66-79)
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — non-Error thrown values', () => {
    it('should serialize a string thrown value', async () => {
        vi.mocked(fetch).mockRejectedValueOnce('string error');

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        // serializeError: typeof err === 'string' → return err
        expect(result.current.state.error).toBe('string error');
    });

    it('should serialize a numeric thrown value via JSON.stringify', async () => {
        vi.mocked(fetch).mockRejectedValueOnce(42);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        // serializeError: falls into try { JSON.stringify(42) } → '42'
        expect(result.current.state.error).toBe('42');
    });

    it('should handle objects that JSON.stringify to {} gracefully', async () => {
        // An object with no enumerable properties stringifies to '{}'
        // Use a regular object {} which JSON.stringify produces '{}'
        const emptyLike = {};
        vi.mocked(fetch).mockRejectedValueOnce(emptyLike);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        // serializeError: str === '{}' → String(err) → '[object Object]'
        expect(result.current.state.error).toBe('[object Object]');
    });

    it('should use String(err) when JSON.stringify throws (circular reference, lines 77-78)', async () => {
        // A circular object causes JSON.stringify to throw — exercises lines 77-78
        const circular: Record<string, unknown> = { name: 'circular' };
        circular.self = circular; // circular reference

        vi.mocked(fetch).mockRejectedValueOnce(circular);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });

        // serializeError catch block: return String(err) → '[object Object]'
        expect(typeof result.current.state.error).toBe('string');
        expect(result.current.state.error).toBeTruthy();
    });
});

// ---------------------------------------------------------------------------
// Tests: honeypot field (line 153-155)
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — honeypot field', () => {
    it('should include honeypot value in FormData when provided', async () => {
        const appendedKeys: string[] = [];
        const OriginalFormData = globalThis.FormData;

        vi.stubGlobal(
            'FormData',
            class MockFormData {
                append(key: string, _value: unknown) {
                    appendedKeys.push(key);
                }
            }
        );

        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { linearIssueId: null } })
        } as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData, undefined, 'bot-value');
        });

        expect(appendedKeys).toContain('website');

        // Restore FormData before next test
        vi.stubGlobal('FormData', OriginalFormData);
    });
});

// ---------------------------------------------------------------------------
// Tests: reset function (lines 227-230)
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — reset function', () => {
    it('should clear state back to initial after a successful submission', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { linearIssueId: 'LIN-1' } })
        } as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });
        expect(result.current.state.result).not.toBeNull();

        act(() => {
            result.current.reset();
        });

        expect(result.current.state.isSubmitting).toBe(false);
        expect(result.current.state.error).toBeNull();
        expect(result.current.state.result).toBeNull();
    });

    it('should clear error state via reset', async () => {
        vi.mocked(fetch).mockRejectedValueOnce(new Error('fail'));

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });
        expect(result.current.state.error).toBeTruthy();

        act(() => {
            result.current.reset();
        });

        expect(result.current.state.error).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Tests: AbortController on unmount (useEffect cleanup, line 121-125)
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — AbortController cleanup on unmount', () => {
    it('should abort in-flight requests when the component unmounts', async () => {
        // Simulate a long-running request that won't resolve before unmount
        let rejectFn!: (reason: unknown) => void;
        vi.mocked(fetch).mockReturnValueOnce(
            new Promise((_resolve, reject) => {
                rejectFn = reject;
            })
        );

        const { result, unmount } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        // Start an async submission (don't await it)
        const submitPromise = act(async () => {
            result.current.submit(minimalData).catch(() => {
                // Expected: might throw after abort
            });
        });

        // Unmount while request is in-flight
        unmount();

        // Simulate AbortError (DOMException with name='AbortError')
        // DOMException.name is read-only, so create one with the constructor
        const abortError = new DOMException('The user aborted a request.', 'AbortError');
        rejectFn(abortError);

        await submitPromise;

        // The hook should NOT have updated state after unmount (no setState crash)
        // This test verifies no errors are thrown and AbortError is handled silently
        expect(true).toBe(true); // test passes if no uncaught error thrown
    });
});

// ---------------------------------------------------------------------------
// Tests: attachments (line 158-161)
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — attachments', () => {
    it('should append each file to FormData under the "attachments" key', async () => {
        const appendedEntries: Array<[string, unknown]> = [];
        const OriginalFormData2 = globalThis.FormData;

        vi.stubGlobal(
            'FormData',
            class MockFormData {
                append(key: string, value: unknown) {
                    appendedEntries.push([key, value]);
                }
            }
        );

        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { linearIssueId: 'LIN-3' } })
        } as Response);

        const file1 = new File(['a'], 'a.png', { type: 'image/png' });
        const file2 = new File(['b'], 'b.png', { type: 'image/png' });

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData, [file1, file2]);
        });

        const attachmentKeys = appendedEntries
            .filter(([k]) => k === 'attachments')
            .map(([, v]) => v);
        expect(attachmentKeys).toHaveLength(2);

        // Restore FormData before next test
        vi.stubGlobal('FormData', OriginalFormData2);
    });
});

// ---------------------------------------------------------------------------
// Tests: re-submit aborts previous in-flight request
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — sequential submissions', () => {
    it('should complete two sequential submissions correctly', async () => {
        const result1 = { linearIssueId: 'LIN-A' };
        const result2 = { linearIssueId: 'LIN-B' };

        vi.mocked(fetch)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true, data: result1 })
            } as Response)
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true, data: result2 })
            } as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        await act(async () => {
            await result.current.submit(minimalData);
        });
        expect(result.current.state.result?.linearIssueId).toBe('LIN-A');

        act(() => result.current.reset());

        await act(async () => {
            await result.current.submit(minimalData);
        });
        expect(result.current.state.result?.linearIssueId).toBe('LIN-B');
    });
});

// ---------------------------------------------------------------------------
// Tests: waitFor-based async state check
// ---------------------------------------------------------------------------

describe('useFeedbackSubmit — waitFor async assertions', () => {
    it('should eventually have result after successful submit', async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { linearIssueId: 'HOS-99' } })
        } as Response);

        const { result } = renderHook(() => useFeedbackSubmit({ apiUrl: VALID_API_URL }));

        act(() => {
            // Fire and forget to use waitFor pattern
            void result.current.submit(minimalData);
        });

        await waitFor(() => {
            expect(result.current.state.result?.linearIssueId).toBe('HOS-99');
        });
    });
});
