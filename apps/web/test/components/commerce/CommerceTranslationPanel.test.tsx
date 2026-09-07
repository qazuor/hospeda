/**
 * @file CommerceTranslationPanel.test.tsx
 * @description Unit tests for the commerce owner i18n editing panel (SPEC-253 T-026).
 *
 * Tests:
 * 1. Renders locale tabs (es, en, pt).
 * 2. Renders all four translatable field textareas for the active locale.
 * 3. Switching tabs shows fields for the new locale.
 * 4. Editing a field calls onChange with the updated values.
 * 5. parseCommerceI18nValues safely parses raw data (happy path + missing
 *    fields) and is deliberately fallback-free (HOS-902 — see its JSDoc for
 *    why baking a display fallback into this function corrupted saves).
 * 6. The panel shows the plain-column fallback in the ES tab ONLY as a
 *    DISPLAY value, for `es` only, and never fabricates a value for
 *    `onChange` on its own (HOS-902).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    type CommerceI18nValues,
    type CommercePlainTextValues,
    CommerceTranslationPanel,
    parseCommerceI18nValues
} from '../../../src/components/commerce/CommerceTranslationPanel.client';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/components/commerce/CommerceTranslationPanel.module.css', () => ({
    default: new Proxy({} as Record<string, string>, { get: (_t, prop) => String(prop) })
}));

vi.mock('../../../src/lib/i18n', () => ({
    // Mirrors the real resolver on the one point that matters here: when a key
    // EXISTS in the catalog its value wins and the fallback is discarded, so an
    // interpolation baked into the fallback never reaches the screen. A plain
    // `fallback ?? key` mock hides exactly that class of bug (BETA-124).
    createTranslations: () => ({
        t: (key: string, fallback?: string, params?: Record<string, unknown>) => {
            const raw =
                key === 'commerce.owner.editor.translationPanel.localePlaceholder'
                    ? 'Ingresá el texto en {{locale}}...'
                    : (fallback ?? key);
            if (!params) return raw;
            return Object.keys(params).reduce(
                (acc, name) => acc.replaceAll(`{{${name}}}`, String(params[name])),
                raw
            );
        }
    })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_I18N: CommerceI18nValues = {
    nameI18n: { es: '', en: '', pt: '' },
    summaryI18n: { es: '', en: '', pt: '' },
    descriptionI18n: { es: '', en: '', pt: '' },
    richDescriptionI18n: { es: '', en: '', pt: '' }
};

const FILLED_I18N: CommerceI18nValues = {
    nameI18n: { es: 'Nombre ES', en: 'Name EN', pt: 'Nome PT' },
    summaryI18n: { es: 'Resumen ES', en: 'Summary EN', pt: 'Resumo PT' },
    descriptionI18n: { es: 'Desc ES', en: 'Desc EN', pt: 'Desc PT' },
    richDescriptionI18n: { es: 'Rich ES', en: 'Rich EN', pt: 'Rich PT' }
};

const EMPTY_PLAIN_TEXT: CommercePlainTextValues = {
    name: '',
    summary: '',
    description: '',
    richDescription: ''
};

function renderPanel(
    initialValues: CommerceI18nValues = EMPTY_I18N,
    onChange = vi.fn(),
    plainTextValues: CommercePlainTextValues = EMPTY_PLAIN_TEXT
) {
    return render(
        <CommerceTranslationPanel
            locale="es"
            initialValues={initialValues}
            plainTextValues={plainTextValues}
            onChange={onChange}
        />
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommerceTranslationPanel', () => {
    it('interpolates the active locale into the placeholder instead of printing the template', () => {
        renderPanel();

        const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
        expect(textareas.length).toBeGreaterThan(0);
        for (const textarea of textareas) {
            expect(textarea.placeholder).toBe('Ingresá el texto en ES...');
            expect(textarea.placeholder).not.toContain('{{');
        }
    });

    it('re-interpolates the placeholder after switching locale tabs', () => {
        renderPanel();

        fireEvent.click(screen.getByRole('tab', { name: /PT/i }));

        const textareas = screen.getAllByRole('textbox') as HTMLTextAreaElement[];
        for (const textarea of textareas) {
            expect(textarea.placeholder).toBe('Ingresá el texto en PT...');
        }
    });

    it('renders locale tabs for es, en, pt', () => {
        renderPanel();
        expect(screen.getByRole('tab', { name: /ES/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /EN/i })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: /PT/i })).toBeInTheDocument();
    });

    it('renders four translatable field textareas for the active locale (es)', () => {
        renderPanel(FILLED_I18N);
        // The active locale is 'es' (matches locale prop)
        // Each field renders a textarea with the es value
        const textareas = screen.getAllByRole('textbox');
        // 4 fields for the active locale
        expect(textareas.length).toBeGreaterThanOrEqual(4);
        // One of them should have the es nameI18n value
        expect(textareas.some((t) => (t as HTMLTextAreaElement).value === 'Nombre ES')).toBe(true);
    });

    it('switches visible fields when clicking the EN tab', () => {
        renderPanel(FILLED_I18N);
        const enTab = screen.getByRole('tab', { name: /EN/i });
        fireEvent.click(enTab);
        const textareas = screen.getAllByRole('textbox');
        expect(textareas.some((t) => (t as HTMLTextAreaElement).value === 'Name EN')).toBe(true);
    });

    it('calls onChange with updated values when editing a field', () => {
        const handleChange = vi.fn();
        renderPanel(EMPTY_I18N, handleChange);

        // Find the nameI18n textarea (first one for es locale)
        const textareas = screen.getAllByRole('textbox');
        fireEvent.change(textareas[0], { target: { value: 'Nuevo nombre ES' } });

        expect(handleChange).toHaveBeenCalledTimes(1);
        const updated = handleChange.mock.calls[0][0] as CommerceI18nValues;
        expect(updated.nameI18n.es).toBe('Nuevo nombre ES');
        // Other fields unchanged
        expect(updated.summaryI18n.es).toBe('');
    });

    it('shows the pt locale fields after clicking the PT tab', () => {
        renderPanel(FILLED_I18N);
        const ptTab = screen.getByRole('tab', { name: /PT/i });
        fireEvent.click(ptTab);
        const textareas = screen.getAllByRole('textbox');
        expect(textareas.some((t) => (t as HTMLTextAreaElement).value === 'Resumo PT')).toBe(true);
    });

    it('accumulates multiple field changes into a single state', () => {
        const handleChange = vi.fn();
        renderPanel(EMPTY_I18N, handleChange);

        const textareas = screen.getAllByRole('textbox');
        fireEvent.change(textareas[0], { target: { value: 'nombre 1' } });
        fireEvent.change(textareas[0], { target: { value: 'nombre 2' } });

        const lastCall = handleChange.mock.calls.at(-1)?.[0] as CommerceI18nValues;
        expect(lastCall.nameI18n.es).toBe('nombre 2');
    });

    describe('ES tab display-only fallback to the plain columns (HOS-902)', () => {
        it('shows the plain name/summary/description/richDescription in the ES tab when i18n is empty', () => {
            renderPanel(EMPTY_I18N, vi.fn(), {
                name: 'Nombre plano',
                summary: 'Resumen plano',
                description: 'Descripción plana',
                richDescription: 'Ampliada plana'
            });

            expect(screen.getByLabelText('Nombre (ES)')).toHaveValue('Nombre plano');
            expect(screen.getByLabelText('Resumen (ES)')).toHaveValue('Resumen plano');
            expect(screen.getByLabelText('Descripción (ES)')).toHaveValue('Descripción plana');
            expect(screen.getByLabelText('Descripción ampliada (ES)')).toHaveValue(
                'Ampliada plana'
            );
        });

        it('never shows the plain-column fallback on the EN or PT tabs', () => {
            renderPanel(EMPTY_I18N, vi.fn(), {
                name: 'Nombre plano',
                summary: '',
                description: '',
                richDescription: ''
            });

            fireEvent.click(screen.getByRole('tab', { name: /EN/i }));
            expect(screen.getByLabelText('Nombre (EN)')).toHaveValue('');

            fireEvent.click(screen.getByRole('tab', { name: /PT/i }));
            expect(screen.getByLabelText('Nombre (PT)')).toHaveValue('');
        });

        it('prefers a genuinely stored i18n value over the plain fallback', () => {
            const values: CommerceI18nValues = {
                ...EMPTY_I18N,
                nameI18n: { es: 'Nombre traducido', en: '', pt: '' }
            };
            renderPanel(values, vi.fn(), { ...EMPTY_PLAIN_TEXT, name: 'Nombre plano' });

            expect(screen.getByLabelText('Nombre (ES)')).toHaveValue('Nombre traducido');
        });

        it('does NOT call onChange merely because the ES tab displays fallback text', () => {
            // Rendering (and re-rendering on tab switches) must never itself
            // fire onChange — only the owner actually typing does. This is
            // the display-vs-write boundary HOS-902 depends on.
            const handleChange = vi.fn();
            renderPanel(EMPTY_I18N, handleChange, { ...EMPTY_PLAIN_TEXT, name: 'Nombre plano' });

            fireEvent.click(screen.getByRole('tab', { name: /EN/i }));
            fireEvent.click(screen.getByRole('tab', { name: /ES/i }));

            expect(handleChange).not.toHaveBeenCalled();
        });

        it('saves exactly what the owner types, built on top of the visible fallback text', () => {
            // The owner appends to the fallback text they see — a normal,
            // intentional edit. What gets saved is the full field content as
            // typed, same as any other controlled textarea.
            const handleChange = vi.fn();
            renderPanel(EMPTY_I18N, handleChange, { ...EMPTY_PLAIN_TEXT, name: 'La Parrilla' });

            fireEvent.change(screen.getByLabelText('Nombre (ES)'), {
                target: { value: 'La Parrilla (Traducido)' }
            });

            expect(handleChange).toHaveBeenCalledTimes(1);
            const updated = handleChange.mock.calls[0][0] as CommerceI18nValues;
            expect(updated.nameI18n.es).toBe('La Parrilla (Traducido)');
        });
    });

    describe('field labels carry the active locale (HOS-371)', () => {
        it('qualifies every field label so it cannot collide with the editor own fields', () => {
            renderPanel(EMPTY_I18N);

            // The hosting editor renders its OWN "Nombre del comercio",
            // "Resumen", "Descripción" and "Descripción ampliada" on the same
            // page. Unqualified, these four announced identically to a screen
            // reader and made `getByRole('textbox', { name })` ambiguous.
            for (const base of ['Nombre', 'Resumen', 'Descripción', 'Descripción ampliada']) {
                expect(screen.getByLabelText(`${base} (ES)`)).toBeInTheDocument();
                expect(screen.queryByLabelText(base)).toBeNull();
            }
        });

        it('updates the qualifier when the locale tab changes', () => {
            renderPanel(EMPTY_I18N);

            fireEvent.click(screen.getByRole('tab', { name: /EN/i }));

            // The locale must live in the NAME, not only in the active tab:
            // the tab is a separate control, so someone landing straight on the
            // field would otherwise never learn which language they are typing.
            expect(screen.getByLabelText('Descripción ampliada (EN)')).toBeInTheDocument();
            expect(screen.queryByLabelText('Descripción ampliada (ES)')).toBeNull();
        });
    });
});

describe('parseCommerceI18nValues', () => {
    it('parses a complete raw record correctly', () => {
        const raw = {
            nameI18n: { es: 'Nombre', en: 'Name', pt: 'Nome' },
            summaryI18n: { es: 'Resumen', en: 'Summary', pt: 'Resumo' },
            descriptionI18n: { es: 'Desc', en: 'Desc', pt: 'Desc' },
            richDescriptionI18n: { es: 'Rich', en: 'Rich', pt: 'Rich' }
        };
        const result = parseCommerceI18nValues(raw);
        expect(result.nameI18n.es).toBe('Nombre');
        expect(result.summaryI18n.en).toBe('Summary');
        expect(result.richDescriptionI18n.pt).toBe('Rich');
    });

    it('returns empty strings for missing fields (no i18n value and no plain fallback)', () => {
        const result = parseCommerceI18nValues({});
        expect(result.nameI18n.es).toBe('');
        expect(result.summaryI18n.en).toBe('');
        expect(result.descriptionI18n.pt).toBe('');
        expect(result.richDescriptionI18n.es).toBe('');
    });

    it('handles null values gracefully', () => {
        const raw = { nameI18n: null, summaryI18n: undefined };
        const result = parseCommerceI18nValues(raw);
        expect(result.nameI18n.es).toBe('');
        expect(result.summaryI18n.en).toBe('');
    });

    it('handles partial locale objects gracefully', () => {
        const raw = { nameI18n: { es: 'Sólo ES' } };
        const result = parseCommerceI18nValues(raw);
        expect(result.nameI18n.es).toBe('Sólo ES');
        expect(result.nameI18n.en).toBe('');
        expect(result.nameI18n.pt).toBe('');
    });

    describe('never falls back to the plain columns (HOS-902)', () => {
        // The ES display fallback lives ONLY in `CommerceTranslationPanel`'s
        // render path (`resolveDisplayValue`) — see the tests in the
        // "ES tab display-only fallback" describe block above. This function
        // is what seeds the live form state AND the PATCH diff baseline, so
        // it must return exactly what is stored, nothing fabricated — a
        // fallback baked in here previously corrupted the save the moment a
        // sibling locale of the same field changed (see its JSDoc for the
        // full incident).
        it('ignores plain name/summary/description/richDescription entirely', () => {
            const raw = {
                name: 'Nombre plano',
                summary: 'Resumen plano',
                description: 'Descripción plana',
                richDescription: 'Ampliada plana'
                // nameI18n / summaryI18n / descriptionI18n / richDescriptionI18n
                // deliberately absent, the exact shape of a listing saved
                // before SPEC-253 added the i18n columns.
            };
            const result = parseCommerceI18nValues(raw);
            expect(result.nameI18n.es).toBe('');
            expect(result.summaryI18n.es).toBe('');
            expect(result.descriptionI18n.es).toBe('');
            expect(result.richDescriptionI18n.es).toBe('');
        });
    });
});
