/**
 * @file use-accommodation-section-form.duplicate-location.test.ts
 * @description A save that moves a published accommodation onto an address its
 * owner already publishes (409 `DUPLICATE_LOCATION`, HOS-1810) shows the
 * explanatory message and not the generic save error.
 */
import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { useAccommodationSectionForm } from '@/components/host/editor/use-accommodation-section-form';

const updateMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/endpoints-protected', () => ({
    accommodationEditApi: { update: updateMock }
}));

beforeEach(() => vi.clearAllMocks());

function setup() {
    return renderHook(() =>
        useAccommodationSectionForm({
            locale: 'es',
            accommodationId: 'acc-1',
            initialValues: { street: 'Mitre' },
            ownFields: ['street'],
            schema: z.object({ street: z.string() })
        })
    );
}

async function save(result: ReturnType<typeof setup>['result']) {
    act(() => {
        result.current.setValue('street', 'Urquiza');
    });
    await act(async () => {
        await result.current.handleSubmit({ preventDefault: () => undefined } as never);
    });
}

describe('useAccommodationSectionForm: one-address rule (HOS-1810)', () => {
    it('maps 409 DUPLICATE_LOCATION to the explanatory form error', async () => {
        updateMock.mockResolvedValue({
            ok: false,
            error: {
                status: 409,
                code: 'ALREADY_EXISTS',
                reason: 'DUPLICATE_LOCATION',
                message: 'Another published listing of yours already occupies this address'
            }
        });
        const { result } = setup();
        await save(result);
        expect(result.current.formError).toMatch(/ya tiene una ficha publicada tuya/i);
    });

    it('keeps the submitted values after a 409 DUPLICATE_LOCATION and clears them on the next submit (HOS-2192)', async () => {
        updateMock.mockResolvedValue({
            ok: false,
            error: {
                status: 409,
                code: 'ALREADY_EXISTS',
                reason: 'DUPLICATE_LOCATION',
                message: 'x'
            }
        });
        const { result } = setup();
        await save(result);
        expect(result.current.refusedLocation).toEqual({ street: 'Urquiza' });
        updateMock.mockResolvedValue({ ok: true, data: {} });
        await act(async () => {
            await result.current.handleSubmit({ preventDefault: () => undefined } as never);
        });
        expect(result.current.refusedLocation).toBeNull();
    });

    it('does not keep values for another failure', async () => {
        updateMock.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'boom' }
        });
        const { result } = setup();
        await save(result);
        expect(result.current.refusedLocation).toBeNull();
    });

    it('keeps the generic error for another failure', async () => {
        updateMock.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR', message: 'boom' }
        });
        const { result } = setup();
        await save(result);
        expect(result.current.formError).not.toMatch(/ya tiene una ficha publicada tuya/i);
    });
});
