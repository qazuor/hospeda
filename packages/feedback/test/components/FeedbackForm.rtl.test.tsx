/**
 * RTL-based tests for FeedbackForm component.
 *
 * Exercises the real multi-step form render path to cover the
 * branches that the pure-helper tests in FeedbackForm.test.tsx
 * could not reach: field changes, step navigation, validation errors,
 * submit (success + error paths), attachments, honeypot, and reset.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeedbackForm } from '../../src/components/FeedbackForm.js';
import { FEEDBACK_STRINGS } from '../../src/config/strings.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock useAutoCollect to avoid the OOM risk from useConsoleCapture + V8
// coverage instrumentation. The hook simply returns a minimal environment.
vi.mock('../../src/hooks/useAutoCollect.js', () => ({
    useAutoCollect: () => ({
        environment: {
            timestamp: new Date().toISOString(),
            appSource: 'web' as const
        },
        updateField: vi.fn()
    })
}));

// Mock useFeedbackSubmit so we can control submit state without real fetch.
const mockSubmit = vi.fn();
const mockReset = vi.fn();

const submitState = {
    isSubmitting: false,
    error: null as string | null,
    result: null as { linearIssueId: string | null; linearIssueUrl?: string | null } | null
};

vi.mock('../../src/hooks/useFeedbackSubmit.js', () => ({
    useFeedbackSubmit: () => ({
        state: submitState,
        submit: mockSubmit,
        reset: mockReset
    })
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Anonymous user — contact fields shown, schema requires email + name */
const DEFAULT_PROPS = {
    apiUrl: 'http://localhost:3001',
    appSource: 'web' as const
};

/**
 * Logged-in user — no contact fields shown (userId set), but email/name
 * must still be provided as props so the hidden initialState passes validation.
 */
const LOGGED_IN_PROPS = {
    ...DEFAULT_PROPS,
    userId: 'usr_123',
    userEmail: 'user@example.com',
    userName: 'Test User'
};

/**
 * Fills in valid step-1 fields (title + description only).
 * For logged-in users email/name come from props, not UI fields.
 */
function fillValidStep1(
    title = 'Something broke in the UI',
    description = 'When I click the submit button nothing happens at all.'
) {
    const titleInput = screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title });
    const descInput = screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.description });

    fireEvent.change(titleInput, { target: { value: title } });
    fireEvent.change(descInput, { target: { value: description } });
}

/**
 * For anonymous users also fills in email and name so full validation passes.
 */
function fillValidStep1Full(
    title = 'Something broke in the UI',
    description = 'When I click the submit button nothing happens at all.',
    email = 'reporter@example.com',
    name = 'Reporter Name'
) {
    fillValidStep1(title, description);
    fireEvent.change(screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.email }), {
        target: { value: email }
    });
    fireEvent.change(screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.name }), {
        target: { value: name }
    });
}

// ---------------------------------------------------------------------------
// Reset submit state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
    submitState.isSubmitting = false;
    submitState.error = null;
    submitState.result = null;
    mockSubmit.mockReset();
    mockReset.mockReset();
    mockSubmit.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Tests: Step 1 — initial render
// ---------------------------------------------------------------------------

describe('FeedbackForm — Step 1 initial render', () => {
    it('should render the form title', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(screen.getByText(FEEDBACK_STRINGS.form.title)).toBeInTheDocument();
    });

    it('should render the type select', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should render title and description inputs', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.description })
        ).toBeInTheDocument();
    });

    it('should render "Agregar más detalles" button', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails })
        ).toBeInTheDocument();
    });

    it('should render "Enviar" button', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit })
        ).toBeInTheDocument();
    });

    it('should render the honeypot div as aria-hidden', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        const honeypot = document.querySelector('[aria-hidden="true"]');
        expect(honeypot).toBeInTheDocument();
    });

    it('should NOT show contact fields when userId is provided', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        expect(
            screen.queryByRole('textbox', { name: FEEDBACK_STRINGS.fields.email })
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('textbox', { name: FEEDBACK_STRINGS.fields.name })
        ).not.toBeInTheDocument();
    });

    it('should show contact fields when userId is NOT provided', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.email })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.name })
        ).toBeInTheDocument();
    });

    it('should pre-fill email and name from props (anonymous user)', () => {
        render(
            <FeedbackForm
                {...DEFAULT_PROPS}
                userEmail="user@test.com"
                userName="Test User"
            />
        );
        const emailInput = screen.getByRole('textbox', {
            name: FEEDBACK_STRINGS.fields.email
        }) as HTMLInputElement;
        const nameInput = screen.getByRole('textbox', {
            name: FEEDBACK_STRINGS.fields.name
        }) as HTMLInputElement;
        expect(emailInput.value).toBe('user@test.com');
        expect(nameInput.value).toBe('Test User');
    });

    it('should apply prefillData type, title and description', () => {
        render(
            <FeedbackForm
                {...DEFAULT_PROPS}
                prefillData={{
                    type: 'feature-request',
                    title: 'Dark mode please',
                    description: 'Please add a dark mode theme to the platform.'
                }}
            />
        );
        const select = screen.getByRole('combobox') as HTMLSelectElement;
        expect(select.value).toBe('feature-request');

        const titleInput = screen.getByRole('textbox', {
            name: FEEDBACK_STRINGS.fields.title
        }) as HTMLInputElement;
        expect(titleInput.value).toBe('Dark mode please');
    });
});

// ---------------------------------------------------------------------------
// Tests: Step 1 — field changes
// ---------------------------------------------------------------------------

describe('FeedbackForm — Step 1 field changes', () => {
    it('should update title when user types', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        const input = screen.getByRole('textbox', {
            name: FEEDBACK_STRINGS.fields.title
        }) as HTMLInputElement;
        fireEvent.change(input, { target: { value: 'New bug title' } });
        expect(input.value).toBe('New bug title');
    });

    it('should update description when user types', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        const textarea = screen.getByRole('textbox', {
            name: FEEDBACK_STRINGS.fields.description
        }) as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: 'Updated description here' } });
        expect(textarea.value).toBe('Updated description here');
    });

    it('should clear error for a field once it changes', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);

        // Trigger validation by clicking submit with empty title
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));

        // Should show validation error
        expect(screen.queryByText(FEEDBACK_STRINGS.validation.titleMin)).toBeInTheDocument();

        // Type into title to clear error
        const input = screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title });
        fireEvent.change(input, { target: { value: 'Fixed title text here' } });

        // Error for title should be cleared
        expect(screen.queryByText(FEEDBACK_STRINGS.validation.titleMin)).not.toBeInTheDocument();
    });

    it('should update honeypot when input changes', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        const honeypotInput = document.querySelector('input[name="website"]') as HTMLInputElement;
        fireEvent.change(honeypotInput, { target: { value: 'bot-fill' } });
        expect(honeypotInput.value).toBe('bot-fill');
    });

    it('should update email field when user types (anonymous)', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        const emailInput = screen.getByRole('textbox', {
            name: FEEDBACK_STRINGS.fields.email
        }) as HTMLInputElement;
        fireEvent.change(emailInput, { target: { value: 'new@test.com' } });
        expect(emailInput.value).toBe('new@test.com');
    });

    it('should update name field when user types (anonymous)', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        const nameInput = screen.getByRole('textbox', {
            name: FEEDBACK_STRINGS.fields.name
        }) as HTMLInputElement;
        fireEvent.change(nameInput, { target: { value: 'Jane Doe' } });
        expect(nameInput.value).toBe('Jane Doe');
    });
});

// ---------------------------------------------------------------------------
// Tests: Step 1 — validation on submit
// ---------------------------------------------------------------------------

describe('FeedbackForm — Step 1 validation on submit', () => {
    it('should show titleMin error when title is empty and submit clicked', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));
        expect(screen.getByText(FEEDBACK_STRINGS.validation.titleMin)).toBeInTheDocument();
    });

    it('should show descriptionMin error when description is empty and submit clicked', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        // Type a valid title
        fireEvent.change(screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title }), {
            target: { value: 'A valid title for test' }
        });
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));
        expect(screen.getByText(FEEDBACK_STRINGS.validation.descriptionMin)).toBeInTheDocument();
    });

    it('should show emailInvalid error when email is invalid', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        fillValidStep1();
        // Fill invalid email
        fireEvent.change(screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.email }), {
            target: { value: 'not-an-email' }
        });
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));
        expect(screen.getByText(FEEDBACK_STRINGS.validation.emailInvalid)).toBeInTheDocument();
    });

    it('should show nameRequired error when name is empty', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        fillValidStep1();
        // Fill valid email but leave name empty
        fireEvent.change(screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.email }), {
            target: { value: 'user@example.com' }
        });
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));
        expect(screen.getByText(FEEDBACK_STRINGS.validation.nameRequired)).toBeInTheDocument();
    });

    it('should call submit when validation passes (logged-in user)', async () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fillValidStep1();
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));
        await waitFor(() => {
            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });
    });

    it('should NOT call submit when title is too short', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fireEvent.change(screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title }), {
            target: { value: 'Hi' }
        });
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));
        expect(mockSubmit).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Tests: collapsible details expander (replaces two-step navigation)
// ---------------------------------------------------------------------------

describe('FeedbackForm — details expander', () => {
    it('should render the expander toggle button (addDetails label when closed)', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails })
        ).toBeInTheDocument();
    });

    it('should have aria-expanded=false on the toggle button when collapsed', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        const toggle = screen.getByRole('button', {
            name: FEEDBACK_STRINGS.buttons.addDetails
        });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have aria-controls pointing to the details panel id', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        const toggle = screen.getByRole('button', {
            name: FEEDBACK_STRINGS.buttons.addDetails
        });
        expect(toggle).toHaveAttribute('aria-controls', 'feedback-details-panel');
    });

    it('should open the details panel and show severity when toggle is clicked', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        expect(screen.getByText(FEEDBACK_STRINGS.fields.severity)).toBeInTheDocument();
    });

    it('should show aria-expanded=true after toggle is clicked', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        const toggle = screen.getByRole('button', {
            name: FEEDBACK_STRINGS.buttons.addDetails
        });
        fireEvent.click(toggle);
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('should change toggle label to hideDetails when expanded', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.hideDetails })
        ).toBeInTheDocument();
    });

    it('should collapse the panel again when toggle is clicked a second time', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        // open
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        // severity is now visible
        expect(screen.getByText(FEEDBACK_STRINGS.fields.severity)).toBeInTheDocument();
        // close (button text changed to hideDetails)
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.hideDetails }));
        // severity is gone from DOM
        expect(screen.queryByText(FEEDBACK_STRINGS.fields.severity)).not.toBeInTheDocument();
    });

    it('should open expander regardless of whether title is empty', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        // Don't fill title — click expander anyway
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        // Expander opens; severity field appears
        expect(screen.getByText(FEEDBACK_STRINGS.fields.severity)).toBeInTheDocument();
    });

    it('should open expander for anonymous user without validation', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        expect(screen.getByText(FEEDBACK_STRINGS.fields.severity)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: submit error display
// ---------------------------------------------------------------------------

describe('FeedbackForm — submit error display', () => {
    it('should display error alert when submitState.error is set (step 1)', () => {
        // Set an error before rendering
        submitState.error = 'Error al enviar el reporte';
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(screen.getByRole('alert').textContent).toBe('Error al enviar el reporte');
    });

    it('should display error alert in step 2 when submitState.error is set', () => {
        submitState.error = 'Error al enviar el reporte';
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fillValidStep1();
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        const alerts = screen.getAllByRole('alert');
        expect(alerts.some((el) => el.textContent === 'Error al enviar el reporte')).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Tests: success screen (step = 'success')
// ---------------------------------------------------------------------------

describe('FeedbackForm — success screen', () => {
    it('should render SuccessScreen when submitState.result is set', () => {
        submitState.result = {
            linearIssueId: 'HOS-42',
            linearIssueUrl: 'https://linear.app/hospeda/issue/HOS-42'
        };
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        // The SuccessScreen shows "¡Reporte enviado!" title
        expect(screen.getByText(FEEDBACK_STRINGS.success.title)).toBeInTheDocument();
    });

    it('should show linearIssueId in SuccessScreen', () => {
        submitState.result = { linearIssueId: 'HOS-42', linearIssueUrl: null };
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(screen.getByText(/HOS-42/)).toBeInTheDocument();
    });

    it('should call onClose when clicking close on success screen', () => {
        submitState.result = { linearIssueId: null, linearIssueUrl: null };
        const onClose = vi.fn();
        render(
            <FeedbackForm
                {...DEFAULT_PROPS}
                onClose={onClose}
            />
        );
        const closeBtn = screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.close });
        fireEvent.click(closeBtn);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should call reset when "Enviar otro" is clicked', async () => {
        submitState.result = { linearIssueId: 'HOS-1', linearIssueUrl: null };
        render(<FeedbackForm {...DEFAULT_PROPS} />);

        const submitAnotherBtn = screen.getByRole('button', {
            name: FEEDBACK_STRINGS.buttons.submitAnother
        });
        fireEvent.click(submitAnotherBtn);

        await waitFor(() => {
            expect(mockReset).toHaveBeenCalledTimes(1);
        });
    });
});

// ---------------------------------------------------------------------------
// Tests: onSentryFeedback bridge callback
// ---------------------------------------------------------------------------

describe('FeedbackForm — onSentryFeedback callback', () => {
    it('should call onSentryFeedback when result is present on mount', async () => {
        const onSentryFeedback = vi.fn();
        submitState.result = { linearIssueId: 'HOS-10', linearIssueUrl: null };

        render(
            <FeedbackForm
                {...DEFAULT_PROPS}
                onSentryFeedback={onSentryFeedback}
                userEmail="reporter@test.com"
                userName="Reporter Name"
            />
        );

        await waitFor(() => {
            expect(onSentryFeedback).toHaveBeenCalledTimes(1);
        });

        const call = onSentryFeedback.mock.calls[0][0];
        expect(call).toHaveProperty('name');
        expect(call).toHaveProperty('email');
        expect(call).toHaveProperty('message');
    });

    it('should NOT crash if onSentryFeedback throws', () => {
        const onSentryFeedback = vi.fn().mockImplementation(() => {
            throw new Error('Sentry SDK error');
        });
        submitState.result = { linearIssueId: null, linearIssueUrl: null };

        // Should not throw
        expect(() => {
            render(
                <FeedbackForm
                    {...DEFAULT_PROPS}
                    onSentryFeedback={onSentryFeedback}
                />
            );
        }).not.toThrow();
    });

    it('should not call onSentryFeedback when there is no result', () => {
        const onSentryFeedback = vi.fn();
        submitState.result = null;

        render(
            <FeedbackForm
                {...DEFAULT_PROPS}
                onSentryFeedback={onSentryFeedback}
            />
        );

        expect(onSentryFeedback).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Tests: isSubmitting disables buttons
// ---------------------------------------------------------------------------

describe('FeedbackForm — isSubmitting state', () => {
    it('should disable expander toggle and submit buttons when isSubmitting=true', () => {
        submitState.isSubmitting = true;
        render(<FeedbackForm {...DEFAULT_PROPS} />);

        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails })
        ).toBeDisabled();
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit })
        ).toBeDisabled();
    });
});

// ---------------------------------------------------------------------------
// Tests: mapZodMessage branches (title max / description max)
// ---------------------------------------------------------------------------

describe('FeedbackForm — mapZodMessage branches', () => {
    it('should show titleMax error when title exceeds max length', () => {
        // Use logged-in props so email/name pre-filled and don't block validation
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        // A title of 201+ chars
        const longTitle = 'A'.repeat(201);
        fireEvent.change(screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title }), {
            target: { value: longTitle }
        });
        fireEvent.change(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.description }),
            { target: { value: 'Valid description for the form.' } }
        );
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));
        expect(screen.getByText(FEEDBACK_STRINGS.validation.titleMax)).toBeInTheDocument();
    });

    it('should show descriptionMax error when description exceeds max length', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fireEvent.change(screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title }), {
            target: { value: 'A valid title for test' }
        });
        // 5001 chars
        const longDesc = 'B'.repeat(5001);
        fireEvent.change(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.description }),
            { target: { value: longDesc } }
        );
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));
        expect(screen.getByText(FEEDBACK_STRINGS.validation.descriptionMax)).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: full submit flow
// ---------------------------------------------------------------------------

describe('FeedbackForm — full submit flow', () => {
    it('should call submit with valid combined data (logged-in user)', async () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fillValidStep1();
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));

        await waitFor(() => {
            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });

        const [formData] = mockSubmit.mock.calls[0] as [Record<string, unknown>, ...unknown[]];
        expect(formData.title).toBe('Something broke in the UI');
        expect(formData.description).toBe('When I click the submit button nothing happens at all.');
        expect(formData.reporterEmail).toBe('user@example.com');
        expect(formData.reporterName).toBe('Test User');
    });

    it('should submit with details panel open (expander visible)', async () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fillValidStep1();
        // Open the details expander
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        // Submit (button always available at form level)
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));

        await waitFor(() => {
            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });
    });

    it('should call submit with valid data from anonymous user', async () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        fillValidStep1Full();
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));

        await waitFor(() => {
            expect(mockSubmit).toHaveBeenCalledTimes(1);
        });

        const [formData] = mockSubmit.mock.calls[0] as [Record<string, unknown>, ...unknown[]];
        expect(formData.reporterEmail).toBe('reporter@example.com');
        expect(formData.reporterName).toBe('Reporter Name');
    });
});

// ---------------------------------------------------------------------------
// Tests: act usage (suppress React warnings for state updates)
// ---------------------------------------------------------------------------

describe('FeedbackForm — state updates (act)', () => {
    it('should handle async submit without React state warnings', async () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fillValidStep1();

        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submit }));
            await mockSubmit.mock.results[0]?.value;
        });

        expect(mockSubmit).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Tests: T-005 single-step + collapsible expander (required test coverage)
// ---------------------------------------------------------------------------

describe('FeedbackForm — single-step + collapsible expander (T-005)', () => {
    // (1) Form mounts with basic fields visible and NO step navigation buttons

    it('should show type select on mount', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should show title input on mount', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.title })
        ).toBeInTheDocument();
    });

    it('should show description textarea on mount', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.description })
        ).toBeInTheDocument();
    });

    it('should NOT render a "Volver" back button at any point', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(
            screen.queryByRole('button', { name: FEEDBACK_STRINGS.buttons.back })
        ).not.toBeInTheDocument();
    });

    it('should have exactly one submit button always visible', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        const submitButtons = screen.getAllByRole('button', {
            name: FEEDBACK_STRINGS.buttons.submit
        });
        expect(submitButtons).toHaveLength(1);
    });

    // (2) Expander is collapsed by default — detail fields NOT in accessible tree

    it('should not show severity field when expander is collapsed (default)', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        expect(screen.queryByText(FEEDBACK_STRINGS.fields.severity)).not.toBeInTheDocument();
    });

    it('should not show stepsToReproduce label when expander is collapsed', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        expect(
            screen.queryByText(FEEDBACK_STRINGS.fields.stepsToReproduce)
        ).not.toBeInTheDocument();
    });

    it('should not show expectedResult label when expander is collapsed', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        expect(screen.queryByText(FEEDBACK_STRINGS.fields.expectedResult)).not.toBeInTheDocument();
    });

    it('should not show actualResult label when expander is collapsed', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        expect(screen.queryByText(FEEDBACK_STRINGS.fields.actualResult)).not.toBeInTheDocument();
    });

    it('should not show attachments section when expander is collapsed', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        expect(screen.queryByText(FEEDBACK_STRINGS.fields.attachments)).not.toBeInTheDocument();
    });

    it('should have aria-expanded=false on toggle button by default', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        const toggle = screen.getByRole('button', {
            name: FEEDBACK_STRINGS.buttons.addDetails
        });
        expect(toggle).toHaveAttribute('aria-expanded', 'false');
    });

    it('should have aria-controls set to the panel id on the toggle', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        const toggle = screen.getByRole('button', {
            name: FEEDBACK_STRINGS.buttons.addDetails
        });
        expect(toggle).toHaveAttribute('aria-controls', 'feedback-details-panel');
    });

    it('should render panel with matching id when expanded', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        const panel = document.getElementById('feedback-details-panel');
        expect(panel).toBeInTheDocument();
    });

    // (3) Toggling expander reveals severity / stepsToReproduce / expected / actual / attachments

    it('should show severity field after expanding', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        expect(screen.getByText(FEEDBACK_STRINGS.fields.severity)).toBeInTheDocument();
    });

    it('should show stepsToReproduce field after expanding', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        expect(screen.getByText(FEEDBACK_STRINGS.fields.stepsToReproduce)).toBeInTheDocument();
    });

    it('should show expectedResult placeholder after expanding', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        expect(
            screen.getByPlaceholderText(FEEDBACK_STRINGS.fields.expectedResultPlaceholder)
        ).toBeInTheDocument();
    });

    it('should show actualResult placeholder after expanding', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        expect(
            screen.getByPlaceholderText(FEEDBACK_STRINGS.fields.actualResultPlaceholder)
        ).toBeInTheDocument();
    });

    it('should show attachments upload zone after expanding', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        expect(screen.getByText(FEEDBACK_STRINGS.fields.uploadButton)).toBeInTheDocument();
    });

    it('should show aria-expanded=true on toggle after expanding', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.addDetails }));
        const toggle = screen.getByRole('button', {
            name: FEEDBACK_STRINGS.buttons.hideDetails
        });
        expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    // (4) Reporter email/name visible when unauthenticated (no userId)

    it('should show email input when user is NOT authenticated', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.email })
        ).toBeInTheDocument();
    });

    it('should show name input when user is NOT authenticated', () => {
        render(<FeedbackForm {...DEFAULT_PROPS} />);
        expect(
            screen.getByRole('textbox', { name: FEEDBACK_STRINGS.fields.name })
        ).toBeInTheDocument();
    });

    it('should hide email and name inputs when user IS authenticated', () => {
        render(<FeedbackForm {...LOGGED_IN_PROPS} />);
        expect(
            screen.queryByRole('textbox', { name: FEEDBACK_STRINGS.fields.email })
        ).not.toBeInTheDocument();
        expect(
            screen.queryByRole('textbox', { name: FEEDBACK_STRINGS.fields.name })
        ).not.toBeInTheDocument();
    });
});
