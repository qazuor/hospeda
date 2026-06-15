// @vitest-environment jsdom
/**
 * @file TranslationStatus.test.tsx
 * @description Component tests for TranslationStatus (SPEC-212 T-019).
 *
 * Covers: pending state, auto-translated badge, manual badge, error state,
 * translate-now button, edit button, and empty state.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string, _count: number) => key
    })
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import { type TranslationFieldState, TranslationStatus } from '../TranslationStatus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeField(
    fieldType: string,
    enValue: string,
    ptValue: string,
    enAuto = true,
    ptAuto = true
): TranslationFieldState {
    return {
        fieldType,
        locales: {
            en: { value: enValue, autoTranslated: enAuto },
            pt: { value: ptValue, autoTranslated: ptAuto }
        }
    };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TranslationStatus', () => {
    const mockTranslateNow = vi.fn();
    const mockOverrideSaved = vi.fn();

    it('returns null when no fields are provided', () => {
        const { container } = render(
            <TranslationStatus
                fields={[]}
                onTranslateNow={mockTranslateNow}
                onOverrideSaved={mockOverrideSaved}
            />
        );
        expect(container.innerHTML).toBe('');
    });

    it('shows pending state for untranslated fields', () => {
        const fields = [makeField('name', '', '')];

        render(
            <TranslationStatus
                fields={fields}
                onTranslateNow={mockTranslateNow}
                onOverrideSaved={mockOverrideSaved}
            />
        );

        const pendingBadges = screen.getAllByText('admin-common.aiTranslate.pending');
        expect(pendingBadges).toHaveLength(2); // EN + PT
        const translateButtons = screen.getAllByText('admin-common.aiTranslate.translateNow');
        expect(translateButtons).toHaveLength(2); // one per locale
    });

    it('shows auto-translated badge when translations exist', () => {
        const fields = [makeField('name', 'River Cabin', 'Cabana do Rio')];

        render(
            <TranslationStatus
                fields={fields}
                onTranslateNow={mockTranslateNow}
                onOverrideSaved={mockOverrideSaved}
            />
        );

        const autoBadges = screen.getAllByText('admin-common.aiTranslate.autoTranslated');
        expect(autoBadges).toHaveLength(2); // one for EN, one for PT

        expect(screen.getByText('River Cabin')).toBeInTheDocument();
        expect(screen.getByText('Cabana do Rio')).toBeInTheDocument();
    });

    it('shows manual-translated badge for overridden translations', () => {
        const fields = [makeField('name', 'My Cabin', 'Minha Cabana', false, false)];

        render(
            <TranslationStatus
                fields={fields}
                onTranslateNow={mockTranslateNow}
                onOverrideSaved={mockOverrideSaved}
            />
        );

        const manualBadges = screen.getAllByText('admin-common.aiTranslate.manualTranslated');
        expect(manualBadges).toHaveLength(2);
    });

    it('shows error state with retry button', () => {
        const field: TranslationFieldState = {
            fieldType: 'description',
            locales: {
                en: { value: '', autoTranslated: false, error: 'API error' },
                pt: { value: '', autoTranslated: false, error: 'API error' }
            }
        };

        render(
            <TranslationStatus
                fields={[field]}
                onTranslateNow={mockTranslateNow}
                onOverrideSaved={mockOverrideSaved}
            />
        );

        const errorBadges = screen.getAllByText('admin-common.aiTranslate.failed');
        expect(errorBadges).toHaveLength(2);

        const retryButtons = screen.getAllByText('admin-common.aiTranslate.retryButton');
        expect(retryButtons).toHaveLength(2);
    });

    it('calls onTranslateNow when Translate Now button is clicked', () => {
        const fields = [makeField('name', '', '')];

        render(
            <TranslationStatus
                fields={fields}
                onTranslateNow={mockTranslateNow}
                onOverrideSaved={mockOverrideSaved}
            />
        );

        const buttons = screen.getAllByText('admin-common.aiTranslate.translateNow');
        fireEvent.click(buttons[0]);
        expect(mockTranslateNow).toHaveBeenCalledWith('name');
    });

    it('calls onTranslateNow when Retry button is clicked on error state', () => {
        const field: TranslationFieldState = {
            fieldType: 'summary',
            locales: {
                en: { value: '', autoTranslated: false, error: 'API error' },
                pt: { value: '', autoTranslated: false, error: 'API error' }
            }
        };

        render(
            <TranslationStatus
                fields={[field]}
                onTranslateNow={mockTranslateNow}
                onOverrideSaved={mockOverrideSaved}
            />
        );

        fireEvent.click(screen.getAllByText('admin-common.aiTranslate.retryButton')[0]);
        expect(mockTranslateNow).toHaveBeenCalledWith('summary');
    });

    it('shows Edit button for translated fields', () => {
        const fields = [makeField('name', 'River Cabin', '')];

        render(
            <TranslationStatus
                fields={fields}
                onTranslateNow={mockTranslateNow}
                onOverrideSaved={mockOverrideSaved}
            />
        );

        expect(screen.getByText('admin-common.aiTranslate.editButton')).toBeInTheDocument();
    });

    it('shows locale codes for each translation', () => {
        const fields = [makeField('name', 'River Cabin', 'Cabana do Rio')];

        render(
            <TranslationStatus
                fields={fields}
                onTranslateNow={mockTranslateNow}
                onOverrideSaved={mockOverrideSaved}
            />
        );

        expect(screen.getByText('EN')).toBeInTheDocument();
        expect(screen.getByText('PT')).toBeInTheDocument();
    });

    it('shows field type labels', () => {
        const fields = [makeField('description', 'Beautiful place', 'Lugar bonito')];

        render(
            <TranslationStatus
                fields={fields}
                onTranslateNow={mockTranslateNow}
                onOverrideSaved={mockOverrideSaved}
            />
        );

        // Field labels are now i18n'd; the mocked t() echoes the key.
        expect(screen.getByText('admin-common.aiTranslate.field.description')).toBeInTheDocument();
    });

    it('renders multiple fields correctly', () => {
        const fields = [
            makeField('name', 'Cabin', 'Cabana'),
            makeField('summary', 'Nice place', 'Lugar agradável')
        ];

        render(
            <TranslationStatus
                fields={fields}
                onTranslateNow={mockTranslateNow}
                onOverrideSaved={mockOverrideSaved}
            />
        );

        expect(screen.getByText('admin-common.aiTranslate.field.name')).toBeInTheDocument();
        expect(screen.getByText('admin-common.aiTranslate.field.summary')).toBeInTheDocument();
        expect(screen.getByText('Cabin')).toBeInTheDocument();
        expect(screen.getByText('Cabana')).toBeInTheDocument();
        expect(screen.getByText('Nice place')).toBeInTheDocument();
        expect(screen.getByText('Lugar agradável')).toBeInTheDocument();
    });
});
