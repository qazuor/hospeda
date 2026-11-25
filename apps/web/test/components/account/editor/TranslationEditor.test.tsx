/** Shared translation presentation, locale accessibility and autosize lifecycle. */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TranslationEditor } from '@/components/account/editor/TranslationEditor';
import { TranslationTextControl } from '@/components/account/editor/TranslationTextControl';
import { Field } from '@/components/account/ui';
import { createT } from '@/lib/i18n';

describe('TranslationEditor', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('resizes on width changes and disconnects its observer on unmount', () => {
        let notify: (() => void) | undefined;
        const disconnect = vi.fn();
        vi.stubGlobal(
            'ResizeObserver',
            class {
                constructor(callback: () => void) {
                    notify = callback;
                }
                observe = vi.fn();
                disconnect = disconnect;
            }
        );
        const { unmount } = render(
            <Field
                locale="en"
                label="Description"
            >
                <TranslationTextControl
                    singleLine={false}
                    value="Long text"
                    placeholder="Description"
                    onChange={vi.fn()}
                />
            </Field>
        );
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        Object.defineProperty(textarea, 'clientWidth', { configurable: true, value: 320 });
        Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 600 });
        notify?.();
        expect(textarea.style.height).toBe('600px');
        Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 700 });
        notify?.();
        expect(textarea.style.height).toBe('600px');
        unmount();
        expect(disconnect).toHaveBeenCalledTimes(1);
    });

    it.each([
        'es',
        'en',
        'pt'
    ] as const)('localizes distinct titles, counts and source hints in %s', (locale) => {
        const t = createT(locale);
        const { container } = render(
            <TranslationEditor
                locale={locale}
                vertical="experience"
                description="Review content"
                defaultLocale="es"
                ariaLabel="Content languages"
                tabs={(['es', 'en', 'pt'] as const).map((language) => ({
                    locale: language,
                    count: language === 'es' ? 0 : 2,
                    countLabel: t('listing.owner.editor.translationPanel.missingCount', undefined, {
                        count: 2
                    }),
                    content: <li>{language}</li>
                }))}
            />
        );
        expect(container.querySelectorAll('[data-kit-section]')).toHaveLength(1);
        expect(
            container.querySelector('[data-help="section:experience.traducciones"]')
        ).not.toBeNull();
        expect(
            screen.getByRole('heading', { name: t('account.editorPresentation.translationTitle') })
        ).toBeInTheDocument();
        const en = screen.getByRole('tab', { name: /^EN/ });
        expect(within(en).getByRole('img')).toHaveAccessibleName(
            t('listing.owner.editor.translationPanel.missingCount', undefined, { count: 2 })
        );
        expect(
            screen.getByText(
                t('account.editorPresentation.missingHint', undefined, { locales: 'EN: 2, PT: 2' })
            )
        ).toBeInTheDocument();
        fireEvent.keyDown(screen.getByRole('tab', { name: /^ES/ }), { key: 'ArrowRight' });
        expect(en).toHaveAttribute('aria-selected', 'true');
    });

    it('uses single-line input names and resizes multiline controls as values and width change', () => {
        const onChange = vi.fn();
        const { rerender } = render(
            <Field
                locale="en"
                id="translated-name"
                label="Name"
            >
                <TranslationTextControl
                    singleLine
                    value="Name"
                    placeholder="Name"
                    onChange={onChange}
                />
            </Field>
        );
        expect(screen.getByRole('textbox').tagName).toBe('INPUT');
        rerender(
            <Field
                locale="en"
                id="translated-description"
                label="Description"
            >
                <TranslationTextControl
                    singleLine={false}
                    value="First paragraph"
                    placeholder="Description"
                    onChange={onChange}
                />
            </Field>
        );
        const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
        Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: 420 });
        rerender(
            <Field
                locale="en"
                id="translated-description"
                label="Description"
            >
                <TranslationTextControl
                    singleLine={false}
                    value="A much longer description"
                    placeholder="Description"
                    onChange={onChange}
                />
            </Field>
        );
        expect(textarea.style.height).toBe('420px');
        expect(textarea.style.overflow).toBe('hidden');
        expect(textarea.style.resize).toBe('none');
        fireEvent.change(textarea, { target: { value: 'Updated' } });
        expect(onChange).toHaveBeenCalledWith('Updated');
    });
});
