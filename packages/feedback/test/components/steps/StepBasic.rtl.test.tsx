/**
 * RTL-based tests for the StepBasic component.
 *
 * Renders the actual component to cover all uncovered branches:
 * - All form fields and their onChange handlers (lines 74-233)
 * - showContactFields=true: email + name fields rendered (lines 161-210)
 * - showContactFields=false: email + name fields absent
 * - Validation error messages displayed when errors object is populated
 * - aria-invalid + aria-describedby attributes set on fields with errors
 * - Action buttons: "Agregar más detalles" and "Enviar"
 * - Button disabled state when isSubmitting=true
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepBasic, type StepBasicData } from '../../../src/components/steps/StepBasic.js';
import { FEEDBACK_STRINGS } from '../../../src/config/strings.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const makeData = (overrides: Partial<StepBasicData> = {}): StepBasicData => ({
    type: 'bug-js',
    title: 'Test title',
    description: 'Test description text',
    reporterEmail: '',
    reporterName: '',
    ...overrides
});

const makeProps = (overrides: Partial<Parameters<typeof StepBasic>[0]> = {}) => ({
    data: makeData(),
    onChange: vi.fn(),
    errors: {},
    showContactFields: false,
    onGoToStep2: vi.fn(),
    onSubmit: vi.fn(),
    isSubmitting: false,
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests: always-rendered structure
// ---------------------------------------------------------------------------

describe('StepBasic — always-rendered structure', () => {
    it('should render the report type label', () => {
        render(<StepBasic {...makeProps()} />);
        expect(screen.getByText(FEEDBACK_STRINGS.fields.type)).toBeInTheDocument();
    });

    it('should render the type select with current value', () => {
        render(<StepBasic {...makeProps({ data: makeData({ type: 'bug-js' }) })} />);
        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
        expect((select as HTMLSelectElement).value).toBe('bug-js');
    });

    it('should render all REPORT_TYPES as options', () => {
        render(<StepBasic {...makeProps()} />);
        // Each report type should be an option in the select
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
    });

    it('should render the title input', () => {
        render(<StepBasic {...makeProps({ data: makeData({ title: 'My bug' }) })} />);
        const input = screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title });
        expect(input).toBeInTheDocument();
        expect((input as HTMLInputElement).value).toBe('My bug');
    });

    it('should render the description textarea', () => {
        render(<StepBasic {...makeProps({ data: makeData({ description: 'My desc' }) })} />);
        const textarea = screen.getByRole('textbox', {
            name: FEEDBACK_STRINGS.fields.description
        });
        expect(textarea).toBeInTheDocument();
        expect((textarea as HTMLTextAreaElement).value).toBe('My desc');
    });

    it('should render "Agregar más detalles" button', () => {
        render(<StepBasic {...makeProps()} />);
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails })
        ).toBeInTheDocument();
    });

    it('should render "Enviar" button', () => {
        render(<StepBasic {...makeProps()} />);
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit })
        ).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: onChange handlers (covers arrow functions in JSX, lines 90, 121, 143)
// ---------------------------------------------------------------------------

describe('StepBasic — onChange handlers', () => {
    it('should call onChange with "type" when select changes', () => {
        const onChange = vi.fn();
        render(<StepBasic {...makeProps({ onChange })} />);

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'feature-request' } });

        expect(onChange).toHaveBeenCalledWith('type', 'feature-request');
    });

    it('should call onChange with "title" when title input changes', () => {
        const onChange = vi.fn();
        render(<StepBasic {...makeProps({ onChange })} />);

        const input = screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title });
        fireEvent.change(input, { target: { value: 'New title' } });

        expect(onChange).toHaveBeenCalledWith('title', 'New title');
    });

    it('should call onChange with "description" when description textarea changes', () => {
        const onChange = vi.fn();
        render(<StepBasic {...makeProps({ onChange })} />);

        const textarea = screen.getByRole('textbox', {
            name: FEEDBACK_STRINGS.fields.description
        });
        fireEvent.change(textarea, { target: { value: 'New description' } });

        expect(onChange).toHaveBeenCalledWith('description', 'New description');
    });
});

// ---------------------------------------------------------------------------
// Tests: button click handlers
// ---------------------------------------------------------------------------

describe('StepBasic — button handlers', () => {
    it('should call onGoToStep2 when "Agregar más detalles" is clicked', () => {
        const onGoToStep2 = vi.fn();
        render(<StepBasic {...makeProps({ onGoToStep2 })} />);

        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));

        expect(onGoToStep2).toHaveBeenCalledTimes(1);
    });

    it('should call onSubmit when "Enviar" button is clicked', () => {
        const onSubmit = vi.fn();
        render(<StepBasic {...makeProps({ onSubmit })} />);

        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));

        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('should disable both buttons when isSubmitting=true', () => {
        render(<StepBasic {...makeProps({ isSubmitting: true })} />);

        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails })
        ).toBeDisabled();
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit })
        ).toBeDisabled();
    });

    it('should enable both buttons when isSubmitting=false', () => {
        render(<StepBasic {...makeProps({ isSubmitting: false })} />);

        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails })
        ).not.toBeDisabled();
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit })
        ).not.toBeDisabled();
    });
});

// ---------------------------------------------------------------------------
// Tests: showContactFields=true (lines 161-210)
// ---------------------------------------------------------------------------

describe('StepBasic — showContactFields=true', () => {
    it('should render the email input when showContactFields is true', () => {
        render(<StepBasic {...makeProps({ showContactFields: true })} />);
        expect(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.email })
        ).toBeInTheDocument();
    });

    it('should render the name input when showContactFields is true', () => {
        render(<StepBasic {...makeProps({ showContactFields: true })} />);
        expect(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.name })
        ).toBeInTheDocument();
    });

    it('should render email input with current value', () => {
        render(
            <StepBasic
                {...makeProps({
                    showContactFields: true,
                    data: makeData({ reporterEmail: 'user@test.com' })
                })}
            />
        );
        const emailInput = screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.email });
        expect((emailInput as HTMLInputElement).value).toBe('user@test.com');
    });

    it('should call onChange with "reporterEmail" when email input changes', () => {
        const onChange = vi.fn();
        render(<StepBasic {...makeProps({ showContactFields: true, onChange })} />);

        const emailInput = screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.email });
        fireEvent.change(emailInput, { target: { value: 'new@example.com' } });

        expect(onChange).toHaveBeenCalledWith('reporterEmail', 'new@example.com');
    });

    it('should call onChange with "reporterName" when name input changes', () => {
        const onChange = vi.fn();
        render(<StepBasic {...makeProps({ showContactFields: true, onChange })} />);

        const nameInput = screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.name });
        fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });

        expect(onChange).toHaveBeenCalledWith('reporterName', 'Jane Doe');
    });
});

// ---------------------------------------------------------------------------
// Tests: showContactFields=false
// ---------------------------------------------------------------------------

describe('StepBasic — showContactFields=false', () => {
    it('should NOT render email input when showContactFields is false', () => {
        render(<StepBasic {...makeProps({ showContactFields: false })} />);
        expect(
            screen.queryByRole('textbox', { name: FEEDBACK_STRINGS.fields.email })
        ).not.toBeInTheDocument();
    });

    it('should NOT render name input when showContactFields is false', () => {
        render(<StepBasic {...makeProps({ showContactFields: false })} />);
        expect(
            screen.queryByRole('textbox', { name: FEEDBACK_STRINGS.fields.name })
        ).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: validation error messages (lines 103-110, 126-133, 149-156, 175-183, 200-208)
// ---------------------------------------------------------------------------

describe('StepBasic — validation error messages', () => {
    it('should display type error message when errors.type is set', () => {
        render(<StepBasic {...makeProps({ errors: { type: 'Tipo requerido' } })} />);
        expect(screen.getByText('Tipo requerido')).toBeInTheDocument();
    });

    it('should display title error message when errors.title is set', () => {
        render(
            <StepBasic
                {...makeProps({ errors: { title: FEEDBACK_STRINGS.validation.titleMin } })}
            />
        );
        expect(screen.getByText(FEEDBACK_STRINGS.validation.titleMin)).toBeInTheDocument();
    });

    it('should display description error when errors.description is set', () => {
        render(
            <StepBasic
                {...makeProps({
                    errors: { description: FEEDBACK_STRINGS.validation.descriptionMin }
                })}
            />
        );
        expect(screen.getByText(FEEDBACK_STRINGS.validation.descriptionMin)).toBeInTheDocument();
    });

    it('should set aria-invalid on the title input when errors.title is set', () => {
        render(<StepBasic {...makeProps({ errors: { title: 'Error' } })} />);
        const input = screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title });
        expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should set aria-describedby on title input when error exists', () => {
        render(<StepBasic {...makeProps({ errors: { title: 'Error' } })} />);
        const input = screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title });
        expect(input).toHaveAttribute('aria-describedby', 'feedback-title-error');
    });

    it('should NOT set aria-invalid when no errors', () => {
        render(<StepBasic {...makeProps({ errors: {} })} />);
        const input = screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title });
        expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('should display email error when showContactFields=true and errors.reporterEmail set', () => {
        render(
            <StepBasic
                {...makeProps({
                    showContactFields: true,
                    errors: { reporterEmail: FEEDBACK_STRINGS.validation.emailInvalid }
                })}
            />
        );
        expect(screen.getByText(FEEDBACK_STRINGS.validation.emailInvalid)).toBeInTheDocument();
    });

    it('should display name error when showContactFields=true and errors.reporterName set', () => {
        render(
            <StepBasic
                {...makeProps({
                    showContactFields: true,
                    errors: { reporterName: FEEDBACK_STRINGS.validation.nameRequired }
                })}
            />
        );
        expect(screen.getByText(FEEDBACK_STRINGS.validation.nameRequired)).toBeInTheDocument();
    });

    it('should render error paragraphs with role="alert"', () => {
        render(<StepBasic {...makeProps({ errors: { title: 'Title error' } })} />);
        const alerts = screen.getAllByRole('alert');
        expect(alerts.length).toBeGreaterThan(0);
        expect(alerts.some((el) => el.textContent === 'Title error')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Tests: placeholder text
// ---------------------------------------------------------------------------

describe('StepBasic — placeholder text', () => {
    it('should show title placeholder', () => {
        render(<StepBasic {...makeProps()} />);
        const input = screen.getByPlaceholderText(FEEDBACK_STRINGS.fields.titlePlaceholder);
        expect(input).toBeInTheDocument();
    });

    it('should show description placeholder', () => {
        render(<StepBasic {...makeProps()} />);
        const textarea = screen.getByPlaceholderText(
            FEEDBACK_STRINGS.fields.descriptionPlaceholder
        );
        expect(textarea).toBeInTheDocument();
    });
});
