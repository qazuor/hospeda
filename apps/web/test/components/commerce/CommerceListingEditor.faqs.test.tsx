/**
 * @file CommerceListingEditor.faqs.test.tsx
 * @description The FAQ block of the commerce owner editor (HOS-811 + HOS-827).
 *
 * WHAT THIS GUARDS, AND WHY IT IS NOT THE SIBLING SUITE.
 * `CommerceFaqManager.test.tsx` already renders the manager in isolation and
 * asserts its transport. It stayed green through HOS-811 for a reason that has
 * nothing to do with the manager: the manager was not part of the editor at
 * all. `editar.astro` mounted it as a SEPARATE `client:idle` island below the
 * form, so every question about it — does it hydrate, is it inside the form's
 * grid, does it sit above the save button — was a question about the page, and
 * the page has no component test. The reported symptom (HOS-811: "the button
 * fires no request at all, no message, no marked field") is exactly what a
 * section that never hydrates looks like from the outside.
 *
 * So these tests render the REAL editor and drive the FAQ form through it:
 *
 * - HOS-811: filling question + answer and pressing the FAQ's own Guardar must
 *   reach `apiClient.postProtected` with the vertical's FAQ endpoint. The
 *   assertion is on the REQUEST, not on a toast — "nothing left the browser"
 *   was the whole bug.
 * - HOS-811 (second half): a blank field must produce a VISIBLE error. The old
 *   code returned silently, which is indistinguishable from a dead control.
 * - HOS-827: the block must live inside the form's own sections column (same
 *   width and alignment as every other card) and BEFORE the save button.
 *
 * `vertical="experience"` on purpose: the sibling suite only ever renders
 * `gastronomy`, so the experience endpoint had no covering test anywhere.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommerceListingDetail } from '../../../src/lib/commerce/owner-listings';

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

vi.mock('../../../src/components/commerce/CommerceListingEditor.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/components/commerce/editor/editor-fields.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/host/editor/RichTextEditor.client', () => ({
    RichTextEditor: ({ ariaLabel }: { ariaLabel?: string }) => <textarea aria-label={ariaLabel} />
}));

// Partial by construction: every verb the editor OR the FAQ manager reaches for
// is listed. A whole-module mock missing `postProtected` would leave the call
// `undefined`, the manager's `await` would throw inside its own handler, and
// this suite would go green having asserted nothing — the exact failure shape
// this file exists to rule out.
vi.mock('../../../src/lib/api/client', () => ({
    apiClient: {
        get: vi.fn(),
        post: vi.fn(),
        postProtected: vi.fn(),
        patch: vi.fn(),
        put: vi.fn(),
        delete: vi.fn()
    }
}));

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    protectedMediaApi: { deleteMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }) },
    commerceMediaApi: {
        listMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: [] } }),
        addMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: {} } }),
        removeMedia: vi.fn().mockResolvedValue({ ok: true, data: {} }),
        setFeaturedMedia: vi.fn().mockResolvedValue({ ok: true, data: { media: {} } })
    }
}));

vi.mock('../../../src/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));
vi.mock('../../../src/lib/logger', () => ({ webLogger: { warn: vi.fn() } }));

import { CommerceListingEditor } from '../../../src/components/commerce/CommerceListingEditor.client';
import { apiClient } from '../../../src/lib/api/client';

const mockPostProtected = vi.mocked(apiClient.postProtected);

const DESTINATION_1 = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';

const baseData = {
    id: LISTING_ID,
    ownerId: 'owner-1',
    name: 'Kayak al atardecer',
    slug: 'kayak-al-atardecer',
    destinationId: DESTINATION_1,
    description: 'Descripción original con suficiente longitud para pasar validación.',
    richDescription: 'old text'
} as unknown as CommerceListingDetail;

function renderEditor() {
    return render(
        <CommerceListingEditor
            vertical="experience"
            listingId={LISTING_ID}
            locale="es"
            initialData={baseData}
            destinations={[{ id: DESTINATION_1, name: 'Concepción del Uruguay' }]}
            amenities={[]}
            features={[]}
            hasFaqSection={true}
            initialFaqs={[]}
        />
    );
}

/** The FAQ block, scoped so the editor's own Guardar can never be the one hit. */
function faqBlock(container: HTMLElement): HTMLElement {
    const block = container.querySelector('#editor-faqs');
    if (!(block instanceof HTMLElement)) {
        throw new Error('the editor rendered no #editor-faqs block');
    }
    return block;
}

/** Opens the add form and fills it. */
function openAndFill({
    container,
    question,
    answer
}: {
    container: HTMLElement;
    question: string;
    answer: string;
}): HTMLElement {
    const block = faqBlock(container);
    fireEvent.click(within(block).getByRole('button', { name: 'Agregar pregunta' }));

    const questionBox = within(block).getByLabelText('Pregunta');
    const answerBox = within(block).getByLabelText('Respuesta');
    fireEvent.change(questionBox, { target: { value: question } });
    fireEvent.change(answerBox, { target: { value: answer } });

    return block;
}

describe('CommerceListingEditor — FAQ block', () => {
    beforeEach(() => {
        mockPostProtected.mockReset();
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                id: 'faq-new',
                question: '¿Hace falta saber nadar?',
                answer: 'No, el recorrido es en aguas calmas y vamos con guía.',
                category: null,
                displayOrder: 0
            }
        } as never);
    });

    // ── HOS-811 ─────────────────────────────────────────────────────────────

    it('fires the add request when a valid FAQ is saved from inside the editor', async () => {
        const { container } = renderEditor();

        const block = openAndFill({
            container,
            question: '¿Hace falta saber nadar?',
            answer: 'No, el recorrido es en aguas calmas y vamos con guía.'
        });

        fireEvent.click(within(block).getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(mockPostProtected).toHaveBeenCalledTimes(1);
        });

        const call = mockPostProtected.mock.calls[0]?.[0] as {
            path: string;
            body: Record<string, unknown>;
        };
        expect(call.path).toBe(`/api/v1/protected/experiences/${LISTING_ID}/faqs`);
        expect(call.body.question).toBe('¿Hace falta saber nadar?');
        expect(call.body.answer).toBe('No, el recorrido es en aguas calmas y vamos con guía.');
    });

    it('shows the saved question in the list once the request succeeds', async () => {
        const { container } = renderEditor();

        const block = openAndFill({
            container,
            question: '¿Hace falta saber nadar?',
            answer: 'No, el recorrido es en aguas calmas y vamos con guía.'
        });
        fireEvent.click(within(block).getByRole('button', { name: 'Guardar' }));

        // Re-queries the block on every poll: the add form is replaced by the
        // list row, so a node captured before the request resolves is stale.
        await waitFor(() => {
            expect(
                within(faqBlock(container)).getByText('¿Hace falta saber nadar?')
            ).toBeInTheDocument();
        });
    });

    it('marks the empty field and says so instead of doing nothing silently', async () => {
        const { container } = renderEditor();

        const block = openAndFill({
            container,
            question: '¿Hace falta saber nadar?',
            answer: '   '
        });
        fireEvent.click(within(block).getByRole('button', { name: 'Guardar' }));

        // The message the owner sees — the bug was that there was none.
        expect(
            await within(block).findByText('Escribí la respuesta antes de guardar.')
        ).toBeInTheDocument();
        expect(within(block).getByLabelText('Respuesta')).toHaveAttribute('aria-invalid', 'true');
        // Still no pointless request.
        expect(mockPostProtected).not.toHaveBeenCalled();
    });

    // ── HOS-827 ─────────────────────────────────────────────────────────────

    it('renders the FAQ block inside the form column, not as a sibling of the form', () => {
        const { container } = renderEditor();

        const column = container.querySelector('.sectionsColumn');
        expect(column).not.toBeNull();
        expect(column?.contains(faqBlock(container))).toBe(true);
    });

    it('places the FAQ block ABOVE the save button', () => {
        const { container } = renderEditor();

        const save = container.querySelector('button[type="submit"]');
        expect(save).not.toBeNull();

        // `querySelectorAll` yields document order, so the index comparison IS
        // the reading order: the FAQ block must come first.
        const inOrder = Array.from(container.querySelectorAll('*'));
        expect(inOrder.indexOf(faqBlock(container))).toBeLessThan(inOrder.indexOf(save as Element));
    });

    it('gives the FAQ block the same section-card class as every other section', () => {
        const { container } = renderEditor();

        // `editor-fields.module.css` is proxy-mocked to echo the class name, so
        // this asserts the block composes the SAME recipe the other cards do —
        // which is what makes it the same width and alignment as they are.
        expect(faqBlock(container).className).toContain('section');
    });

    it('does not render the block at all when the host page does not ask for it', () => {
        const { container } = render(
            <CommerceListingEditor
                vertical="experience"
                listingId={LISTING_ID}
                locale="es"
                initialData={baseData}
                destinations={[{ id: DESTINATION_1, name: 'Concepción del Uruguay' }]}
                amenities={[]}
                features={[]}
            />
        );

        expect(container.querySelector('#editor-faqs')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Agregar pregunta' })).toBeNull();
    });
});
