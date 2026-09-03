/**
 * @file CommerceFaqManager.persistence.test.tsx
 * @description Round-trip guards for the commerce FAQ manager (HOS-811 +
 * HOS-841). Renamed from `CommerceListingEditor.faqs.test.tsx` by HOS-1080.
 *
 * WHAT THIS GUARDS, AND WHY IT IS NOT THE SIBLING SUITE.
 * `CommerceFaqManager.test.tsx` renders the manager and asserts its transport
 * with a fixture shaped the way the buggy code ASSUMED. These tests use the
 * shape the API actually returns: `ExperienceFaqSingleOutputSchema` and its
 * gastronomy twin are both `z.object({ faq: … })`, and HOS-841 was the manager
 * storing that envelope instead of the FAQ inside it — a blank card on screen
 * and a follow-up PUT to `…/faqs/undefined`. Neither is visible unless the
 * fixture is wrapped, which is what makes this suite distinct rather than
 * redundant.
 *
 * They also cover HOS-811's second half: a blank field must produce a VISIBLE
 * error. Returning silently is indistinguishable, from the outside, from a
 * control that never hydrated — which is exactly how HOS-811 was reported.
 *
 * WHAT CHANGED WITH HOS-1080. These tests used to render the whole
 * `CommerceListingEditor` in order to prove the FAQ block hydrated at all,
 * because `editar.astro` mounted the manager as a SEPARATE `client:idle` island
 * below the form and no test covered the page. The FAQ section is its own route
 * now (`editar/preguntas.astro`), which mounts this manager directly with no
 * form around it — so the question "does it hydrate inside the editor's island"
 * no longer exists, and the three HOS-827 layout tests that asked where the card
 * sat relative to the save button went with it. What survives is what was always
 * about the manager itself, now rendered the way its route renders it.
 *
 * `vertical="experience"` on purpose: the sibling suite only ever renders
 * `gastronomy`, so the experience endpoint had no covering test anywhere.
 */

import { fireEvent, render, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/store/toast-store', () => ({ addToast: vi.fn() }));

// Partial by construction: every verb the FAQ manager reaches for is listed. A
// whole-module mock missing `postProtected` would leave the call `undefined`,
// the manager's `await` would throw inside its own handler, and this suite would
// go green having asserted nothing — the exact failure shape this file exists
// to rule out.
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

vi.mock('../../../src/lib/env', () => ({ getApiUrl: () => 'http://api.test' }));
vi.mock('../../../src/lib/logger', () => ({ webLogger: { warn: vi.fn() } }));

import { CommerceFaqManager } from '../../../src/components/commerce/CommerceFaqManager.client';
import { apiClient } from '../../../src/lib/api/client';

const mockPostProtected = vi.mocked(apiClient.postProtected);
const mockPut = vi.mocked(apiClient.put);

const LISTING_ID = '22222222-2222-4222-8222-222222222222';

/** Mounts the manager exactly as `editar/preguntas.astro` does. */
function renderEditor() {
    return render(
        <CommerceFaqManager
            vertical="experience"
            listingId={LISTING_ID}
            locale="es"
            initialFaqs={[]}
        />
    );
}

/** The manager's root, so every `within` query stays scoped to it. */
function faqBlock(container: HTMLElement): HTMLElement {
    const block = container.firstElementChild;
    if (!(block instanceof HTMLElement)) {
        throw new Error('the FAQ manager rendered nothing');
    }
    return block;
}

/**
 * The FAQ rows currently on screen, as their rendered text.
 *
 * Reads the `<li>` rows rather than searching the block for a string, and the
 * caller asserts OUTSIDE `waitFor` (HOS-841). Both matter. `waitFor(() =>
 * getByText(q))` looked like it proved the row rendered and did not: driving the
 * add with the envelope bug still satisfied it, because the text is present in
 * an intermediate render and gone by the time the list settles — `waitFor`
 * resolves on the first poll that does not throw, so it caught the flicker.
 * The identical `getByText` one line later threw. Asserting on settled rows is
 * what makes this catch the blank card.
 */
function faqRowTexts(container: HTMLElement): string[] {
    return within(faqBlock(container))
        .queryAllByRole('listitem')
        .map((row) => row.textContent ?? '');
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

describe('CommerceFaqManager — persistence round trip (HOS-811 / HOS-841)', () => {
    beforeEach(() => {
        mockPostProtected.mockReset();
        mockPut.mockReset();
        // HOS-841: the FAQ arrives WRAPPED — `ExperienceFaqSingleOutputSchema`
        // and its gastronomy twin are both `z.object({ faq: … })`. This fixture
        // used to return the FAQ bare, which is the shape the buggy code
        // assumed, so the suite reproduced the assumption instead of the API and
        // stayed green while the manager put the envelope into the list.
        mockPostProtected.mockResolvedValue({
            ok: true,
            data: {
                faq: {
                    id: 'faq-new',
                    question: '¿Hace falta saber nadar?',
                    answer: 'No, el recorrido es en aguas calmas y vamos con guía.',
                    category: null,
                    displayOrder: 0
                }
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

        // Wait for the list to SETTLE (one row present), then assert on its text
        // outside `waitFor` — see `faqRowTexts`.
        await waitFor(() => {
            expect(faqRowTexts(container)).toHaveLength(1);
        });

        expect(faqRowTexts(container)[0]).toContain('¿Hace falta saber nadar?');
        expect(faqRowTexts(container)[0]).toContain(
            'No, el recorrido es en aguas calmas y vamos con guía.'
        );
    });

    // ── HOS-841 ─────────────────────────────────────────────────────────────

    it('keeps the id of a just-created FAQ, so editing it targets the real row', async () => {
        // The blank card was the visible half of HOS-841; this is the half that
        // corrupted a request. With the envelope stored instead of the FAQ, the
        // new item carried `id: undefined` and the very next edit went to
        // `…/faqs/undefined` (400) while telling the owner the save had failed —
        // on a row that existed. Asserting the rendered text alone cannot catch
        // that: the id is never rendered, only sent. So the assertion is on the
        // PATH of the follow-up request.
        mockPut.mockResolvedValue({
            ok: true,
            data: {
                faq: {
                    id: 'faq-new',
                    question: '¿Hace falta saber nadar? (corregida)',
                    answer: 'No, el recorrido es en aguas calmas y vamos con guía.',
                    category: null,
                    displayOrder: 0
                }
            }
        } as never);

        const { container } = renderEditor();

        const block = openAndFill({
            container,
            question: '¿Hace falta saber nadar?',
            answer: 'No, el recorrido es en aguas calmas y vamos con guía.'
        });
        fireEvent.click(within(block).getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(within(faqBlock(container)).getByRole('button', { name: 'Editar' }));
        });
        fireEvent.click(within(faqBlock(container)).getByRole('button', { name: 'Editar' }));

        const editing = faqBlock(container);
        fireEvent.change(within(editing).getByLabelText('Pregunta'), {
            target: { value: '¿Hace falta saber nadar? (corregida)' }
        });
        fireEvent.click(within(editing).getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(mockPut).toHaveBeenCalledTimes(1);
        });

        const call = mockPut.mock.calls[0]?.[0] as { path: string };
        expect(call.path).toBe(`/api/v1/protected/experiences/${LISTING_ID}/faqs/faq-new`);
        expect(call.path).not.toContain('undefined');
    });

    it('shows the edited text in the list without needing a page reload', async () => {
        // Second half of HOS-841: this PUT answered 200 and the row WAS updated,
        // but the merge spread the envelope over the item, so every field it
        // should have refreshed stayed at its old value on screen.
        mockPut.mockResolvedValue({
            ok: true,
            data: {
                faq: {
                    id: 'faq-new',
                    question: '¿Hace falta saber nadar? (corregida)',
                    answer: 'No, el recorrido es en aguas calmas y vamos con guía.',
                    category: null,
                    displayOrder: 0
                }
            }
        } as never);

        const { container } = renderEditor();

        const block = openAndFill({
            container,
            question: '¿Hace falta saber nadar?',
            answer: 'No, el recorrido es en aguas calmas y vamos con guía.'
        });
        fireEvent.click(within(block).getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(within(faqBlock(container)).getByRole('button', { name: 'Editar' }));
        });
        fireEvent.click(within(faqBlock(container)).getByRole('button', { name: 'Editar' }));

        const editing = faqBlock(container);
        fireEvent.change(within(editing).getByLabelText('Pregunta'), {
            target: { value: '¿Hace falta saber nadar? (corregida)' }
        });
        fireEvent.click(within(editing).getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(mockPut).toHaveBeenCalledTimes(1);
        });
        await waitFor(() => {
            expect(faqRowTexts(container)).toHaveLength(1);
        });

        expect(faqRowTexts(container)[0]).toContain('¿Hace falta saber nadar? (corregida)');
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
});
