/**
 * @file use-accommodation-section-form.test.ts
 * @description Guards the shared section-form payload builder (HOS-318 T-019)
 * and, since HOS-2487, the `save`/`discard` pair the editor save bar drives.
 *
 * The `buildPartialPayload` suites test it directly rather than through the
 * hook. It is the part that can silently corrupt a save — sending a field the
 * page does not own, or dropping half a coordinate pair — and it is pure, so
 * it can be tested for real instead of through a render.
 *
 * The `save`/`discard` suite below renders the real hook (no mocked
 * dependencies — `useZodForm`/`createTranslations` run for real, following
 * the pattern already proven in `use-zod-form.test.ts`).
 */

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
    buildPartialPayload,
    useAccommodationSectionForm
} from '@/components/host/editor/use-accommodation-section-form';

describe('buildPartialPayload — scoping', () => {
    it('should send nothing when nothing changed', () => {
        const values = { name: 'Casa', summary: 'Linda' };

        expect(
            buildPartialPayload({ values, baseline: values, ownFields: ['name', 'summary'] })
        ).toEqual({});
    });

    it('should send only the changed field', () => {
        const payload = buildPartialPayload({
            values: { name: 'Casa nueva', summary: 'Linda' },
            baseline: { name: 'Casa', summary: 'Linda' },
            ownFields: ['name', 'summary']
        });

        expect(payload).toEqual({ name: 'Casa nueva' });
    });

    it('should NEVER send a changed field the page does not own', () => {
        // THE assertion of this whole split. Every form page holds the entire
        // AccommodationEditData for rendering, because the section components
        // take the whole object. If the diff walked the object instead of
        // `ownFields`, editing the price would ship a stale `name` and clobber
        // whatever another tab had just saved.
        const payload = buildPartialPayload({
            values: { basePrice: 30000, name: 'stale name', amenityIds: ['x'] },
            baseline: { basePrice: 25000, name: 'real name', amenityIds: [] },
            ownFields: ['basePrice', 'currency']
        });

        expect(payload).toEqual({ basePrice: 30000 });
        expect(payload).not.toHaveProperty('name');
        expect(payload).not.toHaveProperty('amenityIds');
    });

    it('should ignore an owned field that is absent from the values', () => {
        const payload = buildPartialPayload({
            values: { basePrice: 30000 },
            baseline: { basePrice: 25000 },
            ownFields: ['basePrice', 'currency']
        });

        expect(payload).toEqual({ basePrice: 30000 });
    });

    it('should send an explicit null rather than dropping it', () => {
        // Clearing a field is a real edit; a diff that skipped nulls would make
        // it impossible to unset anything.
        const payload = buildPartialPayload({
            values: { maxGuests: null },
            baseline: { maxGuests: 4 },
            ownFields: ['maxGuests']
        });

        expect(payload).toEqual({ maxGuests: null });
    });
});

describe('buildPartialPayload — field key mapping', () => {
    it('should rename a field to its HTTP key', () => {
        // The social fields are `<network>Url` in the form and bare platform
        // names on the wire.
        const payload = buildPartialPayload({
            values: { facebookUrl: 'https://fb.com/x' },
            baseline: { facebookUrl: '' },
            ownFields: ['facebookUrl'],
            fieldKeyMap: { facebookUrl: 'facebook' }
        });

        expect(payload).toEqual({ facebook: 'https://fb.com/x' });
        expect(payload).not.toHaveProperty('facebookUrl');
    });

    it('should leave unmapped fields under their own name', () => {
        const payload = buildPartialPayload({
            values: { email: 'a@b.com' },
            baseline: { email: '' },
            ownFields: ['email'],
            fieldKeyMap: { facebookUrl: 'facebook' }
        });

        expect(payload).toEqual({ email: 'a@b.com' });
    });
});

describe('buildPartialPayload — arrays', () => {
    it('should detect an added item', () => {
        const payload = buildPartialPayload({
            values: { amenityIds: ['a', 'b'] },
            baseline: { amenityIds: ['a'] },
            ownFields: ['amenityIds']
        });

        expect(payload).toEqual({ amenityIds: ['a', 'b'] });
    });

    it('should detect a removed item', () => {
        const payload = buildPartialPayload({
            values: { amenityIds: ['a'] },
            baseline: { amenityIds: ['a', 'b'] },
            ownFields: ['amenityIds']
        });

        expect(payload).toEqual({ amenityIds: ['a'] });
    });

    it('should detect a swapped item of the same length', () => {
        // Comparing lengths alone would miss this entirely.
        const payload = buildPartialPayload({
            values: { amenityIds: ['a', 'c'] },
            baseline: { amenityIds: ['a', 'b'] },
            ownFields: ['amenityIds']
        });

        expect(payload).toEqual({ amenityIds: ['a', 'c'] });
    });

    it('should treat a reordered array as unchanged', () => {
        // Membership is what the API stores; order carries no meaning.
        const payload = buildPartialPayload({
            values: { amenityIds: ['b', 'a'] },
            baseline: { amenityIds: ['a', 'b'] },
            ownFields: ['amenityIds']
        });

        expect(payload).toEqual({});
    });
});

describe('buildPartialPayload — coordinates travel together', () => {
    const COORDS = ['latitude', 'longitude'];

    it('should send BOTH coordinates when only latitude changed', () => {
        // httpToDomainAccommodationUpdate only emits location.coordinates when
        // both keys are present; sending one silently drops the update and
        // still reports success.
        const payload = buildPartialPayload({
            values: { latitude: -32.48, longitude: -58.23 },
            baseline: { latitude: -32.4, longitude: -58.23 },
            ownFields: COORDS
        });

        expect(payload).toEqual({ latitude: -32.48, longitude: -58.23 });
    });

    it('should send BOTH coordinates when only longitude changed', () => {
        const payload = buildPartialPayload({
            values: { latitude: -32.48, longitude: -58.9 },
            baseline: { latitude: -32.48, longitude: -58.23 },
            ownFields: COORDS
        });

        expect(payload).toEqual({ latitude: -32.48, longitude: -58.9 });
    });

    it('should send neither coordinate when neither changed', () => {
        const values = { latitude: -32.48, longitude: -58.23 };

        expect(buildPartialPayload({ values, baseline: values, ownFields: COORDS })).toEqual({});
    });

    it('should not invent coordinates for a page that does not own them', () => {
        const payload = buildPartialPayload({
            values: { name: 'Casa nueva', latitude: -32.48, longitude: -58.23 },
            baseline: { name: 'Casa', latitude: -32.48, longitude: -58.23 },
            ownFields: ['name']
        });

        expect(payload).not.toHaveProperty('latitude');
        expect(payload).not.toHaveProperty('longitude');
    });

    it('should send both when a coordinate is cleared to null', () => {
        const payload = buildPartialPayload({
            values: { latitude: null, longitude: null },
            baseline: { latitude: -32.48, longitude: -58.23 },
            ownFields: COORDS
        });

        expect(payload).toEqual({ latitude: null, longitude: null });
    });
});

describe('useAccommodationSectionForm — save and discard (HOS-2487)', () => {
    // The page's `EditorSaveBar` drives these two. The way back to the hub is
    // the shell's header link now, so the hook no longer navigates (HOS-1014's
    // `handleCancel` left with the old ActionBar).
    const schema = z.object({ name: z.string().min(1) });

    it('discard puts every field back to the last saved value', () => {
        const { result } = renderHook(() =>
            useAccommodationSectionForm({
                locale: 'es',
                accommodationId: 'acc-123',
                initialValues: { name: 'Casa' },
                ownFields: ['name'],
                schema
            })
        );

        act(() => {
            result.current.setValue('name', 'Casa nueva');
        });
        expect(result.current.isDirty).toBe(true);

        act(() => {
            result.current.discard();
        });

        expect(result.current.values).toEqual({ name: 'Casa' });
        expect(result.current.isDirty).toBe(false);
    });

    it('save resolves a failure naming the invalid field, without a request', async () => {
        const { result } = renderHook(() =>
            useAccommodationSectionForm({
                locale: 'es',
                accommodationId: 'acc-123',
                initialValues: { name: 'Casa' },
                ownFields: ['name'],
                schema
            })
        );
        act(() => {
            result.current.setValue('name', '');
        });

        let outcome: Awaited<ReturnType<typeof result.current.save>> = { ok: true };
        await act(async () => {
            outcome = await result.current.save();
        });

        expect(outcome).toEqual({ ok: false, invalidFields: ['name'] });
    });
});
