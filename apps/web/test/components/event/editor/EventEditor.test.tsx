/**
 * @file EventEditor.test.tsx
 * @description Behaviour tests for the event editor island (HOS-374 Phase 2
 * 2C-3): the PATCH diff, the capability-gated controls, the moderation edit
 * lock, and the month-precision read-only path.
 *
 * `RichTextEditor` is shimmed with a `<textarea>` here so these stay fast; the
 * real TipTap editor is covered by the post editor's `rich-content` suite,
 * which exercises the same shared component.
 *
 * @module test/components/event/editor/EventEditor
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEditor } from '../../../../src/components/event/editor/EventEditor.client';
import type { EventEditDetail } from '../../../../src/lib/api/types';

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('@/components/host/editor/RichTextEditor.client', () => ({
    RichTextEditor: ({
        value,
        onChange,
        ariaLabel,
        id,
        disabled
    }: {
        value: string;
        onChange: (value: string) => void;
        ariaLabel?: string;
        id?: string;
        disabled?: boolean;
    }) => (
        <textarea
            id={id}
            aria-label={ariaLabel}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
        />
    )
}));

vi.mock('../../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string, fallback?: string) => fallback ?? `[MISSING:${key}]`
    })
}));

vi.mock('../../../../src/lib/api/endpoints-protected', () => ({
    eventEditApi: {
        update: vi.fn(),
        softDelete: vi.fn(),
        setPublishState: vi.fn()
    }
}));

import { eventEditApi } from '../../../../src/lib/api/endpoints-protected';
import { addToast } from '../../../../src/store/toast-store';

const mockUpdate = vi.mocked(eventEditApi.update);
const mockSoftDelete = vi.mocked(eventEditApi.softDelete);
const mockSetPublishState = vi.mocked(eventEditApi.setPublishState);

const BASE_EVENT: EventEditDetail = {
    id: 'event-1',
    slug: 'una-fiesta',
    name: 'Una fiesta',
    description: 'x'.repeat(120),
    category: 'MUSIC',
    startDate: '2026-09-10T21:00:00.000Z',
    endDate: '2026-09-11T02:00:00.000Z',
    datePrecision: 'EXACT',
    organizerName: 'Club Social',
    locationName: 'Sala Mayo',
    moderationState: 'PENDING',
    visibility: 'PRIVATE',
    lifecycleState: 'ACTIVE'
};

/** Renders the editor with the given event overrides and capability flags. */
function renderEditor({
    event,
    canPublish = false,
    canDelete = false,
    isEditLocked = false
}: {
    event?: Partial<EventEditDetail>;
    canPublish?: boolean;
    canDelete?: boolean;
    isEditLocked?: boolean;
} = {}) {
    return render(
        <EventEditor
            locale="es"
            initialData={{ ...BASE_EVENT, ...event }}
            canPublish={canPublish}
            canDelete={canDelete}
            isEditLocked={isEditLocked}
        />
    );
}

describe('EventEditor — saving', () => {
    beforeEach(() => {
        mockUpdate.mockReset();
        mockSoftDelete.mockReset();
        mockSetPublishState.mockReset();
        vi.mocked(addToast).mockReset();
    });
    afterEach(() => vi.clearAllMocks());

    it('sends only the edited field', async () => {
        mockUpdate.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor();

        fireEvent.change(screen.getByLabelText('Nombre *'), {
            target: { value: 'Otra fiesta' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
        expect(mockUpdate.mock.calls[0]?.[0]).toEqual({
            id: 'event-1',
            data: { name: 'Otra fiesta' }
        });
    });

    it('sends the start date when only the end date was edited', async () => {
        mockUpdate.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor();

        fireEvent.change(screen.getByLabelText('Termina'), {
            target: { value: '2026-09-11T04:00' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
        const body = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
        // An end-only payload is silently discarded by the server mapper.
        expect(body).toHaveProperty('startDate');
        expect(body).toHaveProperty('endDate');
    });

    it('refuses to save when the author cleared the start date', () => {
        renderEditor();

        fireEvent.change(screen.getByLabelText('Comienza *'), { target: { value: '' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        // Without this guard the cleared start drops out of the diff and the
        // rest of the form saves as if nothing were wrong, silently keeping
        // the old date.
        expect(mockUpdate).not.toHaveBeenCalled();
        expect(screen.getByRole('alert')).toHaveTextContent(
            'El evento necesita una fecha de comienzo.'
        );
    });

    it('never sends a field the server update drops', async () => {
        mockUpdate.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor();

        fireEvent.change(screen.getByLabelText('Descripción *'), {
            target: { value: 'y'.repeat(200) }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
        const body = mockUpdate.mock.calls[0]?.[0]?.data as Record<string, unknown>;
        expect(body).toEqual({ description: 'y'.repeat(200) });
    });

    it('does not call the API when nothing changed, and says so', () => {
        renderEditor();

        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        expect(mockUpdate).not.toHaveBeenCalled();
        expect(addToast).toHaveBeenCalledWith(expect.objectContaining({ type: 'info' }));
    });
});

describe('EventEditor — capability-gated controls', () => {
    beforeEach(() => {
        mockUpdate.mockReset();
        mockSoftDelete.mockReset();
        mockSetPublishState.mockReset();
    });
    afterEach(() => vi.clearAllMocks());

    it('renders NO publish or delete control for a plain editor', () => {
        renderEditor({ canPublish: false, canDelete: false });

        expect(screen.queryByTestId('content-publish-toggle')).not.toBeInTheDocument();
        expect(screen.queryByTestId('content-delete')).not.toBeInTheDocument();
    });

    it('renders the delete control alone when only deletion is granted', () => {
        renderEditor({ canPublish: false, canDelete: true });

        expect(screen.getByTestId('content-delete')).toBeInTheDocument();
        expect(screen.queryByTestId('content-publish-toggle')).not.toBeInTheDocument();
    });

    it('publishes through the publish-state endpoint, never through the PATCH', async () => {
        mockSetPublishState.mockResolvedValueOnce({ ok: true, data: {} });
        renderEditor({ canPublish: true });

        fireEvent.click(screen.getByTestId('content-publish-toggle'));

        await waitFor(() =>
            expect(mockSetPublishState).toHaveBeenCalledWith({
                id: 'event-1',
                visibility: 'PUBLIC'
            })
        );
        expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('blocks publishing while the form holds unsaved edits', () => {
        renderEditor({ canPublish: true });

        fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Otra fiesta' } });

        expect(screen.getByTestId('content-publish-toggle')).toBeDisabled();
    });

    it('requires confirmation before deleting', async () => {
        mockSoftDelete.mockResolvedValueOnce({ ok: true, data: {} });
        Object.defineProperty(window, 'location', { value: { href: '' }, writable: true });
        renderEditor({ canDelete: true });

        fireEvent.click(screen.getByTestId('content-delete'));
        expect(mockSoftDelete).not.toHaveBeenCalled();

        fireEvent.click(screen.getByTestId('content-delete-confirm'));
        await waitFor(() => expect(mockSoftDelete).toHaveBeenCalledWith({ id: 'event-1' }));
    });
});

describe('EventEditor — month-precision dates (HOS-280)', () => {
    beforeEach(() => {
        mockUpdate.mockReset();
    });
    afterEach(() => vi.clearAllMocks());

    it('locks the date fields and says why', () => {
        renderEditor({ event: { datePrecision: 'MONTH' } });

        // The HTTP mapper stamps `precision: EXACT` on every date it writes, so
        // an editable input here would let a confirmed placeholder day silently
        // promote the event to a precision nobody asserted.
        expect(screen.getByTestId('event-month-precision-notice')).toBeInTheDocument();
        expect(screen.getByLabelText('Comienza *')).toBeDisabled();
        expect(screen.getByLabelText('Termina')).toBeDisabled();
    });

    it('leaves the other fields editable', () => {
        renderEditor({ event: { datePrecision: 'MONTH' } });

        expect(screen.getByLabelText('Nombre *')).not.toBeDisabled();
        expect(screen.getByLabelText('Descripción *')).not.toBeDisabled();
    });

    it('shows no notice and editable dates for an EXACT event', () => {
        renderEditor({ event: { datePrecision: 'EXACT' } });

        expect(screen.queryByTestId('event-month-precision-notice')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Comienza *')).not.toBeDisabled();
    });
});

describe('EventEditor — moderation edit lock (§7.6.3)', () => {
    beforeEach(() => {
        mockUpdate.mockReset();
    });
    afterEach(() => vi.clearAllMocks());

    it('warns up front and removes the save control', () => {
        renderEditor({ isEditLocked: true });

        expect(screen.getByTestId('event-editor-lock-notice')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    });

    it('disables the plain fields and the rich-text description', () => {
        renderEditor({ isEditLocked: true });

        expect(screen.getByLabelText('Nombre *')).toBeDisabled();
        // `fieldset[disabled]` does not reach a contenteditable, so the body
        // needs its own flag.
        expect(screen.getByLabelText('Descripción *')).toBeDisabled();
    });

    it('shows no lock notice when the event is editable', () => {
        renderEditor({ isEditLocked: false });

        expect(screen.queryByTestId('event-editor-lock-notice')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    });
});
