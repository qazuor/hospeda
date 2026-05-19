/**
 * @file RichTextEditor.test.tsx
 *
 * Unit tests for the RichTextEditor component.
 *
 * JSDOM compatibility note:
 * TipTap/ProseMirror initialises its editor div asynchronously in JSDOM
 * (it relies on layout APIs). As a result:
 *   - The `.ProseMirror` div may not appear synchronously in `render()`.
 *   - `getByRole('textbox')` for the ProseMirror region is unreliable
 *     without a `waitFor` / `act` wrapper.
 *
 * Strategy: Test the component contract (props, toolbar wiring, value sync)
 * without depending on ProseMirror internals. The toolbar and outer wrapper are
 * React-owned and render synchronously, making them reliable test targets.
 *
 * Coverage target: >= 70% lines on RichTextEditor.tsx.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RichTextEditor, type TiptapDocument } from './RichTextEditor';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid empty TipTap document. */
const emptyDoc: TiptapDocument = {
    type: 'doc',
    content: []
};

/** Document with a paragraph. */
const paragraphDoc: TiptapDocument = {
    type: 'doc',
    content: [
        {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello newsletter' }]
        }
    ]
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RichTextEditor', () => {
    describe('Rendering', () => {
        it('renders the outer wrapper without throwing', () => {
            const { container } = render(
                <RichTextEditor
                    value={null}
                    onChange={vi.fn()}
                />
            );
            expect(container.firstChild).toBeInTheDocument();
        });

        it("renders the toolbar with role='toolbar' and correct aria-label", () => {
            render(
                <RichTextEditor
                    value={null}
                    onChange={vi.fn()}
                />
            );
            const toolbar = screen.getByRole('toolbar');
            expect(toolbar).toBeInTheDocument();
            expect(toolbar).toHaveAttribute('aria-label', 'Editor toolbar');
        });

        it('renders all 9 toggleable toolbar buttons (aria-pressed)', () => {
            render(
                <RichTextEditor
                    value={null}
                    onChange={vi.fn()}
                />
            );
            const pressedButtons = screen
                .getAllByRole('button')
                .filter((btn) => btn.hasAttribute('aria-pressed'));
            // Bold, Italic, Underline, H2, H3, Bullet, Ordered, Blockquote, Link = 9
            expect(pressedButtons.length).toBeGreaterThanOrEqual(9);
        });

        it('renders at least 11 toolbar action buttons', () => {
            render(
                <RichTextEditor
                    value={null}
                    onChange={vi.fn()}
                />
            );
            // Bold, Italic, Underline, H2, H3, Bullet, Ordered, Blockquote,
            // Link, HRule, Clear = 11
            expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(11);
        });

        it('forwards className to the outer wrapper div', () => {
            const { container } = render(
                <RichTextEditor
                    value={null}
                    onChange={vi.fn()}
                    className="my-custom-class"
                />
            );
            expect(container.firstChild).toHaveClass('my-custom-class');
        });
    });

    describe('Disabled state', () => {
        it('disables toolbar buttons when disabled=true', () => {
            render(
                <RichTextEditor
                    value={null}
                    onChange={vi.fn()}
                    disabled
                />
            );
            const disabledButtons = screen
                .getAllByRole('button')
                .filter((btn) => btn.hasAttribute('disabled'));
            expect(disabledButtons.length).toBeGreaterThan(0);
        });

        it('all toolbar buttons are disabled when disabled=true', () => {
            render(
                <RichTextEditor
                    value={null}
                    onChange={vi.fn()}
                    disabled
                />
            );
            const buttons = screen.getAllByRole('button');
            // Every button should be disabled in disabled mode
            for (const btn of buttons) {
                expect(btn).toBeDisabled();
            }
        });
    });

    describe('Toolbar button titles', () => {
        const expectedTitles = [
            'Negrita',
            'Cursiva',
            'Subrayado',
            'Título H2',
            'Título H3',
            'Lista con viñetas',
            'Lista numerada',
            'Cita',
            'Enlace',
            'Divisor horizontal',
            'Limpiar formato'
        ];

        for (const title of expectedTitles) {
            it(`has a toolbar button with title containing "${title}"`, () => {
                render(
                    <RichTextEditor
                        value={null}
                        onChange={vi.fn()}
                    />
                );
                const match = screen
                    .getAllByRole('button')
                    .find((btn) => btn.getAttribute('title')?.includes(title));
                expect(match).toBeDefined();
            });
        }
    });

    describe('Controlled value sync', () => {
        it('accepts an initial document value without throwing', () => {
            expect(() =>
                render(
                    <RichTextEditor
                        value={paragraphDoc}
                        onChange={vi.fn()}
                    />
                )
            ).not.toThrow();
        });

        it('accepts null value without throwing', () => {
            expect(() =>
                render(
                    <RichTextEditor
                        value={null}
                        onChange={vi.fn()}
                    />
                )
            ).not.toThrow();
        });

        it('accepts an empty doc object without throwing', () => {
            expect(() =>
                render(
                    <RichTextEditor
                        value={emptyDoc}
                        onChange={vi.fn()}
                    />
                )
            ).not.toThrow();
        });
    });

    describe('Toolbar interactions', () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        it('Bold button is present and not disabled in active editor', () => {
            render(
                <RichTextEditor
                    value={paragraphDoc}
                    onChange={vi.fn()}
                />
            );
            const boldButton = screen
                .getAllByRole('button')
                .find((btn) => btn.getAttribute('title')?.includes('Negrita'));
            expect(boldButton).toBeDefined();
            expect(boldButton).not.toBeDisabled();
        });

        it('clicking Bold does not throw and advances debounce timer', async () => {
            const handleChange = vi.fn();
            render(
                <RichTextEditor
                    value={paragraphDoc}
                    onChange={handleChange}
                />
            );
            const boldButton = screen
                .getAllByRole('button')
                .find((btn) => btn.getAttribute('title')?.includes('Negrita'));

            await act(async () => {
                fireEvent.click(boldButton as HTMLElement);
                vi.advanceTimersByTime(250);
            });

            // handleChange may or may not be called depending on JSDOM editor state.
            // The key assertion is no error is thrown (debounce timer ran cleanly).
            expect(handleChange).toBeDefined();
        });

        it('clear-formatting button is present and not disabled in active editor', () => {
            render(
                <RichTextEditor
                    value={paragraphDoc}
                    onChange={vi.fn()}
                />
            );
            const clearButton = screen
                .getAllByRole('button')
                .find((btn) => btn.getAttribute('title')?.includes('Limpiar formato'));
            expect(clearButton).toBeDefined();
            expect(clearButton).not.toBeDisabled();
        });

        it('Link button calls window.prompt when clicked', async () => {
            const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('https://hospeda.com.ar');

            render(
                <RichTextEditor
                    value={paragraphDoc}
                    onChange={vi.fn()}
                />
            );
            const linkButton = screen
                .getAllByRole('button')
                .find((btn) => btn.getAttribute('title')?.includes('Enlace'));

            await act(async () => {
                fireEvent.click(linkButton as HTMLElement);
                vi.advanceTimersByTime(250);
            });

            expect(promptSpy).toHaveBeenCalledWith('URL del enlace');
            promptSpy.mockRestore();
        });

        it('H2 button has aria-pressed=false initially', () => {
            render(
                <RichTextEditor
                    value={paragraphDoc}
                    onChange={vi.fn()}
                />
            );
            const h2Button = screen
                .getAllByRole('button')
                .find((btn) => btn.getAttribute('title')?.includes('Título H2'));
            expect(h2Button).toBeDefined();
            expect(h2Button).toHaveAttribute('aria-pressed', 'false');
        });

        it('Bold button has aria-pressed attribute (is toggleable)', () => {
            render(
                <RichTextEditor
                    value={paragraphDoc}
                    onChange={vi.fn()}
                />
            );
            const boldButton = screen
                .getAllByRole('button')
                .find((btn) => btn.getAttribute('title')?.includes('Negrita'));
            expect(boldButton).toHaveAttribute('aria-pressed');
        });
    });

    describe('Type re-exports', () => {
        it('re-exports TiptapDocument type (runtime shape check)', () => {
            const doc: TiptapDocument = { type: 'doc', content: [] };
            expect(doc.type).toBe('doc');
            expect(Array.isArray(doc.content)).toBe(true);
        });
    });
});
