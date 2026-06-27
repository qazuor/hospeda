/**
 * @file CommerceTranslationPanel.test.tsx
 * @description Unit tests for the commerce owner i18n editing panel (SPEC-253 T-026).
 *
 * Tests:
 * 1. Renders locale tabs (es, en, pt).
 * 2. Renders all four translatable field textareas for the active locale.
 * 3. Switching tabs shows fields for the new locale.
 * 4. Editing a field calls onChange with the updated values.
 * 5. parseCommerceI18nValues safely parses raw data (happy path + missing fields).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    type CommerceI18nValues,
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
    createTranslations: () => ({ t: (key: string, fallback?: string) => fallback ?? key })
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

function renderPanel(initialValues: CommerceI18nValues = EMPTY_I18N, onChange = vi.fn()) {
    return render(
        <CommerceTranslationPanel
            locale="es"
            initialValues={initialValues}
            onChange={onChange}
        />
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommerceTranslationPanel', () => {
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

    it('returns empty strings for missing fields', () => {
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
});
