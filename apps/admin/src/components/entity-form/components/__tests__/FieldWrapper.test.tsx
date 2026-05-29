import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldWrapper } from '../FieldWrapper';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWrapper(overrides: Partial<Parameters<typeof FieldWrapper>[0]> = {}) {
    return render(
        <FieldWrapper
            fieldId="field-test"
            label="Nombre"
            mode="edit"
            {...overrides}
        >
            <input
                id="field-test"
                type="text"
            />
        </FieldWrapper>
    );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FieldWrapper — label', () => {
    it('renders the label text', () => {
        renderWrapper({ label: 'Resumen' });
        expect(screen.getByText('Resumen')).toBeInTheDocument();
    });

    it('renders a required asterisk when required=true', () => {
        renderWrapper({ required: true });
        // The asterisk is rendered as a span with aria-hidden
        const asterisk = document.querySelector('[aria-hidden="true"]');
        expect(asterisk?.textContent).toBe('*');
    });

    it('does not render asterisk when required=false', () => {
        renderWrapper({ required: false });
        expect(document.querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it('renders label in destructive color when hasError', () => {
        renderWrapper({ hasError: true, errorMessage: 'Campo requerido' });
        const label = screen.getByText('Nombre');
        expect(label).toHaveClass('text-destructive');
    });

    it('renders label in normal foreground color when no error', () => {
        renderWrapper({ hasError: false });
        const label = screen.getByText('Nombre');
        expect(label).toHaveClass('text-foreground');
        expect(label).not.toHaveClass('text-destructive');
    });
});

describe('FieldWrapper — help icon (edit mode)', () => {
    it('renders (?) help icon when description is provided in edit mode', () => {
        renderWrapper({ description: 'Max 300 caracteres', mode: 'edit' });
        // FieldHelpIcon renders "?" text
        expect(screen.getByRole('img', { name: 'Max 300 caracteres' })).toBeInTheDocument();
    });

    it('does NOT render help icon in view mode even with description', () => {
        renderWrapper({ description: 'Max 300 caracteres', mode: 'view' });
        expect(screen.queryByRole('img')).toBeNull();
    });

    it('does NOT render help icon when description is empty', () => {
        renderWrapper({ description: '', mode: 'edit' });
        expect(screen.queryByRole('img')).toBeNull();
    });
});

describe('FieldWrapper — error message', () => {
    it('renders error message with role=alert when hasError and errorMessage', () => {
        renderWrapper({ hasError: true, errorMessage: 'El campo es obligatorio' });
        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('El campo es obligatorio');
    });

    it('does NOT render error message when hasError=false', () => {
        renderWrapper({ hasError: false, errorMessage: 'some error' });
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('does NOT render error message when errorMessage is undefined', () => {
        renderWrapper({ hasError: true, errorMessage: undefined });
        expect(screen.queryByRole('alert')).toBeNull();
    });
});

describe('FieldWrapper — char counter', () => {
    it('renders char counter when charCount and maxLength are provided', () => {
        renderWrapper({ charCount: 50, maxLength: 300 });
        expect(screen.getByText('50 / 300')).toBeInTheDocument();
    });

    it('does NOT render char counter when maxLength is undefined', () => {
        renderWrapper({ charCount: 50, maxLength: undefined });
        expect(screen.queryByText(/\//)).toBeNull();
    });

    it('does NOT render char counter when charCount is undefined', () => {
        renderWrapper({ charCount: undefined, maxLength: 300 });
        expect(screen.queryByText(/\//)).toBeNull();
    });
});

describe('FieldWrapper — grid alignment (items-start)', () => {
    it('footer row aligns start so error message does not displace grid neighbors', () => {
        // When footer is rendered, the container should use items-start
        const { container } = renderWrapper({
            hasError: true,
            errorMessage: 'Error msg'
        });
        // The error+counter footer div should have items-start
        const footer = container.querySelector('[role="alert"]')?.closest('div');
        expect(footer).toHaveClass('items-start');
    });
});
