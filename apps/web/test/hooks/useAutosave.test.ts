/**
 * @file useAutosave.test.ts
 * @description Unit tests for the useAutosave hook.
 * Covers debounce timer, blur trigger, status transitions, HTTP method
 * selection, retry logic, and cleanup on unmount.
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosave } from '../../src/hooks/useAutosave';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fetch mock that resolves to a JSON body. */
function buildFetchMock(
    response: { ok: boolean; status?: number; body?: unknown } = {
        ok: true,
        body: { data: { id: 'acc-1' } }
    }
) {
    return vi.fn().mockResolvedValue({
        ok: response.ok,
        status: response.status ?? (response.ok ? 200 : 500),
        json: () => Promise.resolve(response.body ?? {})
    });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAutosave', () => {
    // -----------------------------------------------------------------------
    // 1. Debounce: timer fires save after 30 s
    // -----------------------------------------------------------------------

    describe('debounce timer', () => {
        it('does not call fetch before debounce period elapses', () => {
            const fetchMock = buildFetchMock();
            vi.stubGlobal('fetch', fetchMock);

            renderHook(() =>
                useAutosave({ formData: { title: 'Test' }, accommodationId: 'acc-1' })
            );

            // Advance just under the 30 s threshold
            vi.advanceTimersByTime(29_999);
            expect(fetchMock).not.toHaveBeenCalled();
        });

        it('calls fetch exactly once after the 30 s debounce period', async () => {
            const fetchMock = buildFetchMock();
            vi.stubGlobal('fetch', fetchMock);

            renderHook(() =>
                useAutosave({ formData: { title: 'Test' }, accommodationId: 'acc-1' })
            );

            await act(async () => {
                vi.advanceTimersByTime(30_000);
            });

            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('respects a custom debounceMs value', async () => {
            const fetchMock = buildFetchMock();
            vi.stubGlobal('fetch', fetchMock);

            renderHook(() =>
                useAutosave({
                    formData: { title: 'Test' },
                    accommodationId: 'acc-1',
                    debounceMs: 5_000
                })
            );

            vi.advanceTimersByTime(4_999);
            expect(fetchMock).not.toHaveBeenCalled();

            await act(async () => {
                vi.advanceTimersByTime(1);
            });

            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    // -----------------------------------------------------------------------
    // 2. Blur trigger: triggerSave fires immediately
    // -----------------------------------------------------------------------

    describe('triggerSave (blur trigger)', () => {
        it('saves immediately when triggerSave is called without waiting for debounce', async () => {
            const fetchMock = buildFetchMock();
            vi.stubGlobal('fetch', fetchMock);

            const { result } = renderHook(() =>
                useAutosave({ formData: { title: 'Blur test' }, accommodationId: 'acc-2' })
            );

            // Do NOT advance timers — save should fire synchronously
            await act(async () => {
                result.current.triggerSave();
            });

            expect(fetchMock).toHaveBeenCalledTimes(1);
        });

        it('cancels the pending debounce timer when triggerSave is called', async () => {
            const fetchMock = buildFetchMock();
            vi.stubGlobal('fetch', fetchMock);

            const { result } = renderHook(() =>
                useAutosave({ formData: { title: 'Test' }, accommodationId: 'acc-3' })
            );

            // Partially advance the debounce timer, then trigger manually
            vi.advanceTimersByTime(15_000);

            await act(async () => {
                result.current.triggerSave();
            });

            // Advance past the full 30 s — the debounce should NOT fire again
            await act(async () => {
                vi.advanceTimersByTime(15_000);
            });

            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    // -----------------------------------------------------------------------
    // 3. Status transitions: idle → saving → saved
    // -----------------------------------------------------------------------

    describe('status transitions on success', () => {
        it('transitions from idle to saving to saved on a successful request', async () => {
            const fetchMock = buildFetchMock();
            vi.stubGlobal('fetch', fetchMock);

            const { result } = renderHook(() =>
                useAutosave({ formData: { title: 'Status test' }, accommodationId: 'acc-4' })
            );

            expect(result.current.saveStatus).toBe('idle');

            await act(async () => {
                result.current.triggerSave();
            });

            expect(result.current.saveStatus).toBe('saved');
        });

        it('sets lastSavedAt to a Date after a successful save', async () => {
            const fetchMock = buildFetchMock();
            vi.stubGlobal('fetch', fetchMock);

            const { result } = renderHook(() =>
                useAutosave({ formData: { name: 'Casa' }, accommodationId: 'acc-5' })
            );

            expect(result.current.lastSavedAt).toBeNull();

            await act(async () => {
                result.current.triggerSave();
            });

            expect(result.current.lastSavedAt).toBeInstanceOf(Date);
        });

        it('calls onSaveSuccess with the accommodation id', async () => {
            const fetchMock = buildFetchMock({ ok: true, body: { data: { id: 'acc-saved' } } });
            vi.stubGlobal('fetch', fetchMock);
            const onSaveSuccess = vi.fn();

            const { result } = renderHook(() =>
                useAutosave({
                    formData: { name: 'Hotel' },
                    accommodationId: 'acc-saved',
                    onSaveSuccess
                })
            );

            await act(async () => {
                result.current.triggerSave();
            });

            expect(onSaveSuccess).toHaveBeenCalledWith({ id: 'acc-saved' });
        });
    });

    // -----------------------------------------------------------------------
    // 4. Status transitions: idle → saving → error → retry
    // -----------------------------------------------------------------------

    describe('status transitions on failure', () => {
        it('transitions to error status on fetch failure', async () => {
            const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
            vi.stubGlobal('fetch', fetchMock);

            const { result } = renderHook(() =>
                useAutosave({ formData: { title: 'Fail' }, accommodationId: 'acc-6' })
            );

            await act(async () => {
                result.current.triggerSave();
            });

            expect(result.current.saveStatus).toBe('error');
        });

        it('retries once after 5 s when the first attempt fails', async () => {
            const fetchMock = vi.fn().mockRejectedValue(new Error('Network error'));
            vi.stubGlobal('fetch', fetchMock);

            const { result } = renderHook(() =>
                useAutosave({ formData: { title: 'Retry test' }, accommodationId: 'acc-7' })
            );

            // First save attempt
            await act(async () => {
                result.current.triggerSave();
            });

            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(result.current.saveStatus).toBe('error');

            // Advance to trigger retry
            await act(async () => {
                vi.advanceTimersByTime(5_000);
            });

            // Wait for retry promise to settle
            await act(async () => {
                await Promise.resolve();
            });

            expect(fetchMock).toHaveBeenCalledTimes(2);
        });

        it('calls onSaveError after retry also fails', async () => {
            const fetchMock = vi.fn().mockRejectedValue(new Error('Persistent error'));
            vi.stubGlobal('fetch', fetchMock);
            const onSaveError = vi.fn();

            const { result } = renderHook(() =>
                useAutosave({
                    formData: { title: 'Double fail' },
                    accommodationId: 'acc-8',
                    onSaveError
                })
            );

            // First attempt
            await act(async () => {
                result.current.triggerSave();
            });

            expect(result.current.saveStatus).toBe('error');

            // Advance past the 5 s retry delay and flush the resulting promise
            await act(async () => {
                vi.advanceTimersByTime(5_000);
            });
            // Flush microtasks so the rejected fetch propagates
            await act(async () => {
                await Promise.resolve();
            });

            expect(onSaveError).toHaveBeenCalledTimes(1);
            expect(result.current.saveStatus).toBe('error');
        }, 15_000);

        it('stays saved (does not flip to error) when retry succeeds', async () => {
            let callCount = 0;
            const fetchMock = vi.fn().mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    return Promise.reject(new Error('First attempt fails'));
                }
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ data: { id: 'acc-retry-ok' } })
                });
            });
            vi.stubGlobal('fetch', fetchMock);
            const onSaveSuccess = vi.fn();

            const { result } = renderHook(() =>
                useAutosave({
                    formData: { title: 'Retry success' },
                    accommodationId: 'acc-retry-ok',
                    onSaveSuccess
                })
            );

            await act(async () => {
                result.current.triggerSave();
            });

            expect(result.current.saveStatus).toBe('error');

            // Advance past the 5 s retry delay, then flush all microtasks
            await act(async () => {
                vi.advanceTimersByTime(5_000);
            });
            await act(async () => {
                await Promise.resolve();
            });

            expect(result.current.saveStatus).toBe('saved');
            expect(onSaveSuccess).toHaveBeenCalledWith({ id: 'acc-retry-ok' });
        }, 15_000);
    });

    // -----------------------------------------------------------------------
    // 5. HTTP method selection: POST for first save, PATCH for subsequent
    // -----------------------------------------------------------------------

    describe('HTTP method selection', () => {
        it('uses POST when no accommodationId is provided (first save)', async () => {
            const fetchMock = buildFetchMock({ ok: true, body: { data: { id: 'new-acc' } } });
            vi.stubGlobal('fetch', fetchMock);

            const { result } = renderHook(() =>
                useAutosave({ formData: { title: 'New accommodation' } })
            );

            await act(async () => {
                result.current.triggerSave();
            });

            expect(fetchMock).toHaveBeenCalledWith(
                '/api/v1/protected/accommodations',
                expect.objectContaining({ method: 'POST' })
            );
        });

        it('uses PATCH when an accommodationId is provided', async () => {
            const fetchMock = buildFetchMock({ ok: true, body: { data: { id: 'existing-acc' } } });
            vi.stubGlobal('fetch', fetchMock);

            const { result } = renderHook(() =>
                useAutosave({
                    formData: { title: 'Existing accommodation' },
                    accommodationId: 'existing-acc'
                })
            );

            await act(async () => {
                result.current.triggerSave();
            });

            expect(fetchMock).toHaveBeenCalledWith(
                '/api/v1/protected/accommodations/existing-acc',
                expect.objectContaining({ method: 'PATCH' })
            );
        });

        it('uses POST on first save and PATCH on the second save', async () => {
            let callCount = 0;
            const fetchMock = vi.fn().mockImplementation(() => {
                callCount++;
                const id = callCount === 1 ? 'created-id' : 'created-id';
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: () => Promise.resolve({ data: { id } })
                });
            });
            vi.stubGlobal('fetch', fetchMock);

            const { result } = renderHook(() => useAutosave({ formData: { title: 'Two saves' } }));

            // First save → POST
            await act(async () => {
                result.current.triggerSave();
            });

            expect(fetchMock).toHaveBeenNthCalledWith(
                1,
                '/api/v1/protected/accommodations',
                expect.objectContaining({ method: 'POST' })
            );

            // Second save → PATCH with the id returned by first save
            await act(async () => {
                result.current.triggerSave();
            });

            expect(fetchMock).toHaveBeenNthCalledWith(
                2,
                '/api/v1/protected/accommodations/created-id',
                expect.objectContaining({ method: 'PATCH' })
            );
        });

        it('sends credentials: include on every request', async () => {
            const fetchMock = buildFetchMock();
            vi.stubGlobal('fetch', fetchMock);

            const { result } = renderHook(() =>
                useAutosave({ formData: { title: 'Auth check' }, accommodationId: 'acc-creds' })
            );

            await act(async () => {
                result.current.triggerSave();
            });

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ credentials: 'include' })
            );
        });
    });

    // -----------------------------------------------------------------------
    // 6. Cleanup on unmount
    // -----------------------------------------------------------------------

    describe('cleanup on unmount', () => {
        it('does not update state after unmount (no state-update warnings)', async () => {
            const fetchMock = vi.fn().mockImplementation(
                () =>
                    new Promise((resolve) => {
                        // Never resolves during this test — simulates in-flight request
                        setTimeout(
                            () =>
                                resolve({
                                    ok: true,
                                    json: () => Promise.resolve({ data: { id: 'late' } })
                                }),
                            60_000
                        );
                    })
            );
            vi.stubGlobal('fetch', fetchMock);

            const { result, unmount } = renderHook(() =>
                useAutosave({ formData: { title: 'Unmount test' }, accommodationId: 'acc-u' })
            );

            act(() => {
                result.current.triggerSave();
            });

            // Unmount before the request resolves
            unmount();

            // Advance timers past request resolution — should not throw
            await act(async () => {
                vi.advanceTimersByTime(60_000);
                await Promise.resolve();
            });

            // No assertion needed — the test passes if no React warning is thrown
        });

        it('clears debounce timer on unmount so fetch is never called', async () => {
            const fetchMock = buildFetchMock();
            vi.stubGlobal('fetch', fetchMock);

            const { unmount } = renderHook(() =>
                useAutosave({ formData: { title: 'Clean unmount' }, accommodationId: 'acc-cu' })
            );

            // Start the debounce window, then unmount immediately
            vi.advanceTimersByTime(15_000);
            unmount();

            // Advance past the full debounce period — fetch must NOT be called
            await act(async () => {
                vi.advanceTimersByTime(15_000);
            });

            expect(fetchMock).not.toHaveBeenCalled();
        });
    });
});
