/**
 * @file use-single-flight.test.ts
 * @description Regression test (HOS-2429, double-click): a second trigger while
 * the first confirmation is still open is ignored instead of stacking dialogs.
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSingleFlight } from '@/lib/forms/use-single-flight';

describe('useSingleFlight', () => {
    it('runs the second task only after the first has settled', async () => {
        const { result } = renderHook(() => useSingleFlight());
        let release: (value: boolean) => void = () => {};
        const first = vi.fn(() => new Promise<boolean>((resolve) => (release = resolve)));
        const second = vi.fn(async () => true);

        let firstRun: Promise<boolean | undefined> = Promise.resolve(undefined);
        act(() => {
            firstRun = result.current(first);
        });
        const ignored = await result.current(second);

        expect(ignored).toBeUndefined();
        expect(second).not.toHaveBeenCalled();

        await act(async () => {
            release(true);
            await firstRun;
        });
        expect(await result.current(second)).toBe(true);
        expect(second).toHaveBeenCalledTimes(1);
    });

    it('frees the slot even when the task throws', async () => {
        const { result } = renderHook(() => useSingleFlight());
        await expect(
            result.current(async () => {
                throw new Error('boom');
            })
        ).rejects.toThrow('boom');
        expect(await result.current(async () => 'ok')).toBe('ok');
    });
});
