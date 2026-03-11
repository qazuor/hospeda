/**
 * @file contact-form.test.tsx
 * @description Tests for ContactForm.client.tsx (post-T-022 migration).
 * Covers rendering, field validation (empty / min-length / email format),
 * form submission (loading state, API call via contactApi, success/error toasts),
 * inline error clearing on user input, and accessibility attributes.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock toast store BEFORE importing the component so the module binding is replaced.
vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

// Mock @sentry/astro to prevent real Sentry calls during tests.
vi.mock('@sentry/astro', () => ({
    captureException: vi.fn()
}));

// Mock global fetch — the apiClient internally uses fetch.
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { ContactForm } from '../../../src/components/content/ContactForm.client';
import { addToast } from '../../../src/store/toast-store';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fill all four form fields with valid data using the Spanish locale labels. */
function fillValidForm(): void {
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'Test subject' } });
    fireEvent.change(screen.getByLabelText('Mensaje'), {
        target: { value: 'This is a test message with more than 20 characters' }
    });
}

/** Submit the form by dispatching a submit event on the <form> element. */
function submitForm(): void {
    const button = screen.getByRole('button', { name: 'Enviar mensaje' });
    const form = button.closest('form');
    if (form) fireEvent.submit(form);
}

/**
 * Build a minimal fetch mock response that satisfies apiClient's expectations.
 * apiClient calls response.json() and checks response.ok.
 */
function mockSuccessResponse(data: unknown = {}) {
    return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, data })
    };
}

function mockErrorResponse(status = 500) {
    return {
        ok: false,
        status,
        json: async () => ({ success: false, error: { code: 'ERROR', message: 'Server error' } })
    };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

beforeEach(() => {
    vi.mocked(addToast).mockClear();
    mockFetch.mockClear();
});

afterEach(() => {
    vi.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContactForm.client.tsx', () => {
    describe('Rendering', () => {
        it('should render all four form fields', () => {
            // Arrange & Act
            render(<ContactForm />);

            // Assert
            expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
            expect(screen.getByLabelText('Email')).toBeInTheDocument();
            expect(screen.getByLabelText('Asunto')).toBeInTheDocument();
            expect(screen.getByLabelText('Mensaje')).toBeInTheDocument();
        });

        it('should render a submit button with type="submit"', () => {
            // Arrange & Act
            render(<ContactForm />);

            // Assert
            const button = screen.getByRole('button', { name: 'Enviar mensaje' });
            expect(button).toBeInTheDocument();
            expect(button).toHaveAttribute('type', 'submit');
        });

        it('should render the name input with a placeholder', () => {
            // Arrange & Act
            render(<ContactForm />);

            // Assert
            expect(screen.getByLabelText('Nombre')).toHaveAttribute('placeholder', 'Tu nombre');
        });

        it('should render the email input with a placeholder', () => {
            // Arrange & Act
            render(<ContactForm />);

            // Assert
            expect(screen.getByLabelText('Email')).toHaveAttribute('placeholder', 'tu@email.com');
        });

        it('should render the subject input with a placeholder', () => {
            // Arrange & Act
            render(<ContactForm />);

            // Assert
            expect(screen.getByLabelText('Asunto')).toHaveAttribute(
                'placeholder',
                'Asunto de tu mensaje'
            );
        });

        it('should render the message textarea with a placeholder', () => {
            // Arrange & Act
            render(<ContactForm />);

            // Assert
            expect(screen.getByLabelText('Mensaje')).toHaveAttribute(
                'placeholder',
                'Escribí tu mensaje aquí...'
            );
        });
    });

    describe('Props', () => {
        it('should apply a custom className to the form element', () => {
            // Arrange & Act
            const { container } = render(<ContactForm className="custom-form" />);

            // Assert
            expect(container.querySelector('form')).toHaveClass('custom-form');
        });

        it('should accept locale="en" and display English labels', () => {
            // Arrange & Act
            render(<ContactForm locale="en" />);

            // Assert
            expect(screen.getByLabelText('Name')).toBeInTheDocument();
            expect(screen.getByLabelText('Subject')).toBeInTheDocument();
            expect(screen.getByLabelText('Message')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
        });
    });

    describe('Validation — empty required fields', () => {
        it('should display four required-field errors on empty submit', async () => {
            // Arrange
            render(<ContactForm />);

            // Act
            submitForm();

            // Assert — all four error containers show the generic "required" message
            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts).toHaveLength(4);
                for (const alert of alerts) {
                    expect(alert.textContent).toBe('Este campo es requerido');
                }
            });
        });

        it('should NOT call the API when validation fails', async () => {
            // Arrange
            render(<ContactForm />);

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(mockFetch).not.toHaveBeenCalled();
            });
        });

        it('should set id="name-error" on the name error element', async () => {
            // Arrange
            render(<ContactForm />);

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(document.getElementById('name-error')).toBeInTheDocument();
            });
        });
    });

    describe('Validation — minimum length rules', () => {
        it('should show min-length error for name shorter than 2 characters', async () => {
            // Arrange
            render(<ContactForm />);
            fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'A' } });

            // Act
            submitForm();

            // Assert — generic tooSmall message from validation.json
            await waitFor(() => {
                const nameError = document.getElementById('name-error');
                expect(nameError?.textContent).toBe('El valor es demasiado corto');
            });
        });

        it('should show min-length error for subject shorter than 3 characters', async () => {
            // Arrange
            render(<ContactForm />);
            fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'AB' } });

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                const subjectError = document.getElementById('subject-error');
                expect(subjectError?.textContent).toBe('El valor es demasiado corto');
            });
        });

        it('should show min-length error for message shorter than 20 characters', async () => {
            // Arrange
            render(<ContactForm />);
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'Short msg' }
            });

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                const messageError = document.getElementById('message-error');
                expect(messageError?.textContent).toBe('El valor es demasiado corto');
            });
        });
    });

    describe('Validation — email format (GAP-011)', () => {
        it('should show an invalid-email error for a malformed email address', async () => {
            // Arrange
            render(<ContactForm />);
            fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'John Doe' } });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'invalid-email' }
            });
            fireEvent.change(screen.getByLabelText('Asunto'), {
                target: { value: 'Test Subject' }
            });
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'This is a valid message with more than twenty characters' }
            });

            // Act
            submitForm();

            // Assert — generic invalidEmail message from validation.json
            await waitFor(() => {
                const emailError = document.getElementById('email-error');
                expect(emailError?.textContent).toBe('Debe ser un email válido');
            });
        });

        it('should show an error for an email missing the @ character', async () => {
            // Arrange
            render(<ContactForm />);
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'userdomain.com' }
            });
            submitForm();

            // Assert
            await waitFor(() => {
                const emailError = document.getElementById('email-error');
                expect(emailError?.textContent).toBe('Debe ser un email válido');
            });
        });

        it('should not show an email error for a valid email address', async () => {
            // Arrange
            render(<ContactForm />);
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'user@example.com' }
            });
            fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'John Doe' } });
            submitForm();

            // Assert — email error specifically must be absent
            await waitFor(() => {
                expect(document.getElementById('email-error')).not.toBeInTheDocument();
            });
        });
    });

    describe('Form submission — loading state', () => {
        it('should disable all fields while the request is in flight', async () => {
            // Arrange — keep fetch pending
            let resolveFetch!: (value: unknown) => void;
            mockFetch.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveFetch = resolve;
                    })
            );
            render(<ContactForm />);
            fillValidForm();

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(screen.getByLabelText('Nombre')).toBeDisabled();
                expect(screen.getByLabelText('Email')).toBeDisabled();
                expect(screen.getByLabelText('Asunto')).toBeDisabled();
                expect(screen.getByLabelText('Mensaje')).toBeDisabled();
            });

            // Cleanup — resolve so React can unmount cleanly
            await act(async () => {
                resolveFetch(mockSuccessResponse());
            });
        });

        it('should show a loading text on the submit button during submission', async () => {
            // Arrange
            let resolveFetch!: (value: unknown) => void;
            mockFetch.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        resolveFetch = resolve;
                    })
            );
            render(<ContactForm />);
            fillValidForm();

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Enviando...' })).toBeInTheDocument();
            });

            await act(async () => {
                resolveFetch(mockSuccessResponse());
            });
        });
    });

    describe('API integration', () => {
        it('should POST to the contact endpoint with the mapped field values', async () => {
            // Arrange — contactApi.sendContactMessage splits name into firstName/lastName
            mockFetch.mockResolvedValue(mockSuccessResponse());
            render(<ContactForm />);
            fillValidForm();

            // Act
            submitForm();

            // Assert — apiClient uses fetch internally
            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);

                const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
                expect(url).toContain('/api/v1/public/contact');
                expect(opts.method).toBe('POST');

                const body = JSON.parse(opts.body as string) as Record<string, unknown>;
                expect(body).toMatchObject({
                    firstName: 'John',
                    lastName: 'Doe',
                    email: 'john@example.com',
                    message: 'This is a test message with more than 20 characters',
                    type: 'general'
                });
            });
        });

        it('should show a success toast and reset the form on a successful response', async () => {
            // Arrange
            mockFetch.mockResolvedValue(mockSuccessResponse());
            render(<ContactForm />);
            fillValidForm();

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(vi.mocked(addToast)).toHaveBeenCalledWith({
                    type: 'success',
                    message: 'Tu mensaje fue enviado correctamente'
                });
            });

            // Form should be reset
            expect(screen.getByLabelText('Nombre')).toHaveValue('');
            expect(screen.getByLabelText('Email')).toHaveValue('');
            expect(screen.getByLabelText('Asunto')).toHaveValue('');
            expect(screen.getByLabelText('Mensaje')).toHaveValue('');
        });

        it('should show an error toast when the API returns a non-OK status', async () => {
            // Arrange
            mockFetch.mockResolvedValue(mockErrorResponse(500));
            render(<ContactForm />);
            fillValidForm();

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(vi.mocked(addToast)).toHaveBeenCalledWith({
                    type: 'error',
                    message: 'No se pudo enviar el mensaje. Intentá nuevamente.'
                });
            });
        });

        it('should show an error toast when the fetch itself throws a network error', async () => {
            // Arrange
            mockFetch.mockRejectedValue(new Error('Network error'));
            render(<ContactForm />);
            fillValidForm();

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(vi.mocked(addToast)).toHaveBeenCalledWith({
                    type: 'error',
                    message: 'No se pudo enviar el mensaje. Intentá nuevamente.'
                });
            });
        });

        it('should re-enable all fields after a failed submission', async () => {
            // Arrange
            mockFetch.mockRejectedValue(new Error('Network error'));
            render(<ContactForm />);
            fillValidForm();

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(screen.getByLabelText('Nombre')).not.toBeDisabled();
                expect(screen.getByLabelText('Email')).not.toBeDisabled();
                expect(screen.getByLabelText('Asunto')).not.toBeDisabled();
                expect(screen.getByLabelText('Mensaje')).not.toBeDisabled();
            });
        });

        it('should retain form data after a failed submission', async () => {
            // Arrange
            mockFetch.mockRejectedValue(new Error('Network error'));
            render(<ContactForm />);
            fillValidForm();

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(vi.mocked(addToast)).toHaveBeenCalled();
            });
            expect(screen.getByLabelText('Nombre')).toHaveValue('John Doe');
            expect(screen.getByLabelText('Email')).toHaveValue('john@example.com');
        });
    });

    describe('Error clearing on user input', () => {
        it('should clear the name error as the user types in the name field', async () => {
            // Arrange
            render(<ContactForm />);
            submitForm();
            await waitFor(() => {
                expect(document.getElementById('name-error')).toBeInTheDocument();
            });

            // Act
            fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'John' } });

            // Assert
            await waitFor(() => {
                expect(document.getElementById('name-error')).not.toBeInTheDocument();
            });
        });

        it('should clear the email error as the user types in the email field', async () => {
            // Arrange
            render(<ContactForm />);
            submitForm();
            await waitFor(() => {
                expect(document.getElementById('email-error')).toBeInTheDocument();
            });

            // Act
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'john@example.com' }
            });

            // Assert
            await waitFor(() => {
                expect(document.getElementById('email-error')).not.toBeInTheDocument();
            });
        });

        it('should clear the subject error as the user types in the subject field', async () => {
            // Arrange
            render(<ContactForm />);
            submitForm();
            await waitFor(() => {
                expect(document.getElementById('subject-error')).toBeInTheDocument();
            });

            // Act
            fireEvent.change(screen.getByLabelText('Asunto'), { target: { value: 'Test' } });

            // Assert
            await waitFor(() => {
                expect(document.getElementById('subject-error')).not.toBeInTheDocument();
            });
        });

        it('should clear the message error as the user types in the message field', async () => {
            // Arrange
            render(<ContactForm />);
            submitForm();
            await waitFor(() => {
                expect(document.getElementById('message-error')).toBeInTheDocument();
            });

            // Act
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'Some text' }
            });

            // Assert
            await waitFor(() => {
                expect(document.getElementById('message-error')).not.toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should mark all inputs as aria-required="true"', () => {
            // Arrange & Act
            render(<ContactForm />);

            // Assert
            expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-required', 'true');
            expect(screen.getByLabelText('Email')).toHaveAttribute('aria-required', 'true');
            expect(screen.getByLabelText('Asunto')).toHaveAttribute('aria-required', 'true');
            expect(screen.getByLabelText('Mensaje')).toHaveAttribute('aria-required', 'true');
        });

        it('should set aria-invalid="true" on fields that fail validation', async () => {
            // Arrange
            render(<ContactForm />);

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
                expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
                expect(screen.getByLabelText('Asunto')).toHaveAttribute('aria-invalid', 'true');
                expect(screen.getByLabelText('Mensaje')).toHaveAttribute('aria-invalid', 'true');
            });
        });

        it('should link fields to their error messages via aria-describedby', async () => {
            // Arrange
            render(<ContactForm />);

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(screen.getByLabelText('Nombre')).toHaveAttribute(
                    'aria-describedby',
                    'name-error'
                );
                expect(screen.getByLabelText('Email')).toHaveAttribute(
                    'aria-describedby',
                    'email-error'
                );
                expect(screen.getByLabelText('Asunto')).toHaveAttribute(
                    'aria-describedby',
                    'subject-error'
                );
                expect(screen.getByLabelText('Mensaje')).toHaveAttribute(
                    'aria-describedby',
                    'message-error'
                );
            });
        });

        it('should give all validation error paragraphs role="alert"', async () => {
            // Arrange
            render(<ContactForm />);

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                const alerts = screen.getAllByRole('alert');
                expect(alerts).toHaveLength(4);
            });
        });

        it('should give all error messages aria-live="polite"', async () => {
            // Arrange
            const { container } = render(<ContactForm />);

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                const errors = Array.from(container.querySelectorAll('[role="alert"]'));
                for (const error of errors) {
                    expect(error).toHaveAttribute('aria-live', 'polite');
                }
            });
        });
    });

    describe('Styling', () => {
        it('should apply space-y-4 to the form for field spacing', () => {
            // Arrange & Act
            const { container } = render(<ContactForm />);

            // Assert
            expect(container.querySelector('form')?.className).toContain('space-y-4');
        });

        it('should apply error border color when a field has an error', async () => {
            // Arrange
            render(<ContactForm />);

            // Act
            submitForm();

            // Assert
            await waitFor(() => {
                expect(screen.getByLabelText('Nombre').className).toContain('border-destructive');
            });
        });

        it('should apply normal border color when a field has no error', () => {
            // Arrange & Act
            render(<ContactForm />);

            // Assert
            expect(screen.getByLabelText('Nombre').className).toContain('border-border');
        });
    });
});
