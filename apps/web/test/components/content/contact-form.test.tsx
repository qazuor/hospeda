import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock toast store BEFORE importing component
vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { ContactForm } from '../../../src/components/content/ContactForm.client';
import { addToast } from '../../../src/store/toast-store';

describe('ContactForm.client.tsx', () => {
    beforeEach(() => {
        vi.mocked(addToast).mockClear();
        mockFetch.mockClear();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render all form fields', () => {
            render(<ContactForm />);

            expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
            expect(screen.getByLabelText('Email')).toBeInTheDocument();
            expect(screen.getByLabelText('Asunto')).toBeInTheDocument();
            expect(screen.getByLabelText('Mensaje')).toBeInTheDocument();
        });

        it('should render submit button', () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            expect(submitButton).toBeInTheDocument();
            expect(submitButton).toHaveAttribute('type', 'submit');
        });

        it('should render name input with placeholder', () => {
            render(<ContactForm />);

            const nameInput = screen.getByLabelText('Nombre');
            expect(nameInput).toHaveAttribute('placeholder', 'Tu nombre');
        });

        it('should render email input with placeholder', () => {
            render(<ContactForm />);

            const emailInput = screen.getByLabelText('Email');
            expect(emailInput).toHaveAttribute('placeholder', 'tu@email.com');
        });

        it('should render subject input with placeholder', () => {
            render(<ContactForm />);

            const subjectInput = screen.getByLabelText('Asunto');
            expect(subjectInput).toHaveAttribute('placeholder', 'Asunto de tu mensaje');
        });

        it('should render message textarea with placeholder', () => {
            render(<ContactForm />);

            const messageTextarea = screen.getByLabelText('Mensaje');
            expect(messageTextarea).toHaveAttribute('placeholder', 'Escribí tu mensaje aquí...');
        });
    });

    describe('Props', () => {
        it('should default locale to "es"', () => {
            render(<ContactForm />);

            expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeInTheDocument();
        });

        it('should accept locale prop and display English labels', () => {
            render(<ContactForm locale="en" />);

            expect(screen.getByLabelText('Name')).toBeInTheDocument();
            expect(screen.getByLabelText('Email')).toBeInTheDocument();
            expect(screen.getByLabelText('Subject')).toBeInTheDocument();
            expect(screen.getByLabelText('Message')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
        });

        it('should accept className prop', () => {
            const { container } = render(<ContactForm className="custom-class" />);

            const form = container.querySelector('form');
            expect(form).toHaveClass('custom-class');
        });
    });

    describe('Validation - Empty Fields', () => {
        it('should show validation errors for empty required fields on submit', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
                expect(screen.getByText('El email es obligatorio')).toBeInTheDocument();
                expect(screen.getByText('El asunto es obligatorio')).toBeInTheDocument();
                expect(screen.getByText('El mensaje es obligatorio')).toBeInTheDocument();
            });
        });

        it('should show name required error when name is empty', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
            });
        });

        it('should show email required error when email is empty', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El email es obligatorio')).toBeInTheDocument();
            });
        });

        it('should show subject required error when subject is empty', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El asunto es obligatorio')).toBeInTheDocument();
            });
        });

        it('should show message required error when message is empty', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El mensaje es obligatorio')).toBeInTheDocument();
            });
        });
    });

    describe('Validation - Min Length', () => {
        it('should show min length error for name (< 2)', async () => {
            render(<ContactForm />);

            const nameInput = screen.getByLabelText('Nombre');
            fireEvent.change(nameInput, { target: { value: 'A' } });

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(
                    screen.getByText('El nombre debe tener al menos 2 caracteres')
                ).toBeInTheDocument();
            });
        });

        it('should show min length error for subject (< 3)', async () => {
            render(<ContactForm />);

            const subjectInput = screen.getByLabelText('Asunto');
            fireEvent.change(subjectInput, { target: { value: 'AB' } });

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(
                    screen.getByText('El asunto debe tener al menos 3 caracteres')
                ).toBeInTheDocument();
            });
        });

        it('should show min length error for message (< 20)', async () => {
            render(<ContactForm />);

            const messageTextarea = screen.getByLabelText('Mensaje');
            fireEvent.change(messageTextarea, { target: { value: 'Short message' } });

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(
                    screen.getByText('El mensaje debe tener al menos 20 caracteres')
                ).toBeInTheDocument();
            });
        });
    });

    describe('Validation - Email Format', () => {
        it('should show invalid email error for bad email format', async () => {
            render(<ContactForm />);

            // Fill all fields except email with valid data
            fireEvent.change(screen.getByLabelText('Nombre'), {
                target: { value: 'John Doe' }
            });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'invalid-email' }
            });
            fireEvent.change(screen.getByLabelText('Asunto'), {
                target: { value: 'Test Subject' }
            });
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'This is a valid message with more than twenty characters' }
            });

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El email no es válido')).toBeInTheDocument();
            });

            // Should NOT call API when validation fails
            expect(mockFetch).not.toHaveBeenCalled();
        });

        it('should show invalid email error for email without @', async () => {
            render(<ContactForm />);

            // Fill all fields except email with valid data
            fireEvent.change(screen.getByLabelText('Nombre'), {
                target: { value: 'John Doe' }
            });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'invalidemail.com' }
            });
            fireEvent.change(screen.getByLabelText('Asunto'), {
                target: { value: 'Test Subject' }
            });
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'This is a valid message with more than twenty characters' }
            });

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El email no es válido')).toBeInTheDocument();
            });
        });

        it('should show invalid email error for email without domain', async () => {
            render(<ContactForm />);

            // Fill all fields except email with valid data
            fireEvent.change(screen.getByLabelText('Nombre'), {
                target: { value: 'John Doe' }
            });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'user@' }
            });
            fireEvent.change(screen.getByLabelText('Asunto'), {
                target: { value: 'Test Subject' }
            });
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'This is a valid message with more than twenty characters' }
            });

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El email no es válido')).toBeInTheDocument();
            });
        });

        it('should accept valid email format', async () => {
            render(<ContactForm />);

            const emailInput = screen.getByLabelText('Email');
            fireEvent.change(emailInput, { target: { value: 'user@example.com' } });

            const nameInput = screen.getByLabelText('Nombre');
            fireEvent.change(nameInput, { target: { value: 'John Doe' } });

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.queryByText('El email no es válido')).not.toBeInTheDocument();
            });
        });
    });

    describe('Form Submission - Loading State', () => {
        it('should disable all fields during submission', async () => {
            mockFetch.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve({ ok: true, json: () => ({}) }), 100);
                    })
            );

            render(<ContactForm />);

            // Fill form
            fireEvent.change(screen.getByLabelText('Nombre'), {
                target: { value: 'John Doe' }
            });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'john@example.com' }
            });
            fireEvent.change(screen.getByLabelText('Asunto'), {
                target: { value: 'Test subject' }
            });
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'This is a test message with more than 20 characters' }
            });

            // Submit
            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByLabelText('Nombre')).toBeDisabled();
                expect(screen.getByLabelText('Email')).toBeDisabled();
                expect(screen.getByLabelText('Asunto')).toBeDisabled();
                expect(screen.getByLabelText('Mensaje')).toBeDisabled();
            });
        });

        it('should show loading text on submit button during submission', async () => {
            mockFetch.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve({ ok: true, json: () => ({}) }), 100);
                    })
            );

            render(<ContactForm />);

            // Fill form
            fireEvent.change(screen.getByLabelText('Nombre'), {
                target: { value: 'John Doe' }
            });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'john@example.com' }
            });
            fireEvent.change(screen.getByLabelText('Asunto'), {
                target: { value: 'Test subject' }
            });
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'This is a test message with more than 20 characters' }
            });

            // Submit
            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Enviando...' })).toBeInTheDocument();
            });
        });
    });

    describe('API Integration', () => {
        it('should call API on valid submit', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            render(<ContactForm />);

            // Fill form
            fireEvent.change(screen.getByLabelText('Nombre'), {
                target: { value: 'John Doe' }
            });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'john@example.com' }
            });
            fireEvent.change(screen.getByLabelText('Asunto'), {
                target: { value: 'Test subject' }
            });
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'This is a test message with more than 20 characters' }
            });

            // Submit
            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(mockFetch).toHaveBeenCalledTimes(1);
                expect(mockFetch).toHaveBeenCalledWith(
                    'http://localhost:3001/api/v1/public/contact',
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            name: 'John Doe',
                            email: 'john@example.com',
                            subject: 'Test subject',
                            message: 'This is a test message with more than 20 characters'
                        })
                    }
                );
            });
        });

        it('should show success toast and reset form on success', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            render(<ContactForm />);

            // Fill form
            fireEvent.change(screen.getByLabelText('Nombre'), {
                target: { value: 'John Doe' }
            });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'john@example.com' }
            });
            fireEvent.change(screen.getByLabelText('Asunto'), {
                target: { value: 'Test subject' }
            });
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'This is a test message with more than 20 characters' }
            });

            // Submit
            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(vi.mocked(addToast)).toHaveBeenCalledTimes(1);
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

        it('should show error toast on API failure', async () => {
            mockFetch.mockResolvedValue({
                ok: false,
                status: 500
            });

            render(<ContactForm />);

            // Fill form
            fireEvent.change(screen.getByLabelText('Nombre'), {
                target: { value: 'John Doe' }
            });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'john@example.com' }
            });
            fireEvent.change(screen.getByLabelText('Asunto'), {
                target: { value: 'Test subject' }
            });
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'This is a test message with more than 20 characters' }
            });

            // Submit
            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(vi.mocked(addToast)).toHaveBeenCalledTimes(1);
                expect(vi.mocked(addToast)).toHaveBeenCalledWith({
                    type: 'error',
                    message: 'No se pudo enviar el mensaje. Intentá nuevamente.'
                });
            });

            // Form should keep data
            expect(screen.getByLabelText('Nombre')).toHaveValue('John Doe');
            expect(screen.getByLabelText('Email')).toHaveValue('john@example.com');
            expect(screen.getByLabelText('Asunto')).toHaveValue('Test subject');
            expect(screen.getByLabelText('Mensaje')).toHaveValue(
                'This is a test message with more than 20 characters'
            );
        });

        it('should keep form data on error and re-enable fields', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'));

            render(<ContactForm />);

            // Fill form
            fireEvent.change(screen.getByLabelText('Nombre'), {
                target: { value: 'John Doe' }
            });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'john@example.com' }
            });
            fireEvent.change(screen.getByLabelText('Asunto'), {
                target: { value: 'Test subject' }
            });
            fireEvent.change(screen.getByLabelText('Mensaje'), {
                target: { value: 'This is a test message with more than 20 characters' }
            });

            // Submit
            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(vi.mocked(addToast)).toHaveBeenCalledWith({
                    type: 'error',
                    message: 'No se pudo enviar el mensaje. Intentá nuevamente.'
                });
            });

            // Fields should be re-enabled
            expect(screen.getByLabelText('Nombre')).not.toBeDisabled();
            expect(screen.getByLabelText('Email')).not.toBeDisabled();
            expect(screen.getByLabelText('Asunto')).not.toBeDisabled();
            expect(screen.getByLabelText('Mensaje')).not.toBeDisabled();
        });
    });

    describe('Error Clearing', () => {
        it('should clear name error when user types', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
            });

            const nameInput = screen.getByLabelText('Nombre');
            fireEvent.change(nameInput, { target: { value: 'John' } });

            await waitFor(() => {
                expect(screen.queryByText('El nombre es obligatorio')).not.toBeInTheDocument();
            });
        });

        it('should clear email error when user types', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El email es obligatorio')).toBeInTheDocument();
            });

            const emailInput = screen.getByLabelText('Email');
            fireEvent.change(emailInput, { target: { value: 'john@example.com' } });

            await waitFor(() => {
                expect(screen.queryByText('El email es obligatorio')).not.toBeInTheDocument();
            });
        });

        it('should clear subject error when user types', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El asunto es obligatorio')).toBeInTheDocument();
            });

            const subjectInput = screen.getByLabelText('Asunto');
            fireEvent.change(subjectInput, { target: { value: 'Test' } });

            await waitFor(() => {
                expect(screen.queryByText('El asunto es obligatorio')).not.toBeInTheDocument();
            });
        });

        it('should clear message error when user types', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El mensaje es obligatorio')).toBeInTheDocument();
            });

            const messageTextarea = screen.getByLabelText('Mensaje');
            fireEvent.change(messageTextarea, {
                target: { value: 'This is a test message' }
            });

            await waitFor(() => {
                expect(screen.queryByText('El mensaje es obligatorio')).not.toBeInTheDocument();
            });
        });
    });

    describe('Locale Switching', () => {
        it('should display Spanish labels when locale is "es"', () => {
            render(<ContactForm locale="es" />);

            expect(screen.getByLabelText('Nombre')).toBeInTheDocument();
            expect(screen.getByLabelText('Email')).toBeInTheDocument();
            expect(screen.getByLabelText('Asunto')).toBeInTheDocument();
            expect(screen.getByLabelText('Mensaje')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeInTheDocument();
        });

        it('should display English labels when locale is "en"', () => {
            render(<ContactForm locale="en" />);

            expect(screen.getByLabelText('Name')).toBeInTheDocument();
            expect(screen.getByLabelText('Email')).toBeInTheDocument();
            expect(screen.getByLabelText('Subject')).toBeInTheDocument();
            expect(screen.getByLabelText('Message')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
        });

        it('should display Spanish placeholders when locale is "es"', () => {
            render(<ContactForm locale="es" />);

            expect(screen.getByLabelText('Nombre')).toHaveAttribute('placeholder', 'Tu nombre');
            expect(screen.getByLabelText('Email')).toHaveAttribute('placeholder', 'tu@email.com');
            expect(screen.getByLabelText('Asunto')).toHaveAttribute(
                'placeholder',
                'Asunto de tu mensaje'
            );
            expect(screen.getByLabelText('Mensaje')).toHaveAttribute(
                'placeholder',
                'Escribí tu mensaje aquí...'
            );
        });

        it('should display English placeholders when locale is "en"', () => {
            render(<ContactForm locale="en" />);

            expect(screen.getByLabelText('Name')).toHaveAttribute('placeholder', 'Your name');
            expect(screen.getByLabelText('Email')).toHaveAttribute('placeholder', 'your@email.com');
            expect(screen.getByLabelText('Subject')).toHaveAttribute(
                'placeholder',
                'Subject of your message'
            );
            expect(screen.getByLabelText('Message')).toHaveAttribute(
                'placeholder',
                'Write your message here...'
            );
        });

        it('should display localized error messages in Spanish', async () => {
            render(<ContactForm locale="es" />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('El nombre es obligatorio')).toBeInTheDocument();
                expect(screen.getByText('El email es obligatorio')).toBeInTheDocument();
                expect(screen.getByText('El asunto es obligatorio')).toBeInTheDocument();
                expect(screen.getByText('El mensaje es obligatorio')).toBeInTheDocument();
            });
        });

        it('should display localized error messages in English', async () => {
            render(<ContactForm locale="en" />);

            const submitButton = screen.getByRole('button', { name: 'Send message' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByText('Name is required')).toBeInTheDocument();
                expect(screen.getByText('Email is required')).toBeInTheDocument();
                expect(screen.getByText('Subject is required')).toBeInTheDocument();
                expect(screen.getByText('Message is required')).toBeInTheDocument();
            });
        });

        it('should display English loading text when locale is "en"', async () => {
            mockFetch.mockImplementation(
                () =>
                    new Promise((resolve) => {
                        setTimeout(() => resolve({ ok: true, json: () => ({}) }), 100);
                    })
            );

            render(<ContactForm locale="en" />);

            // Fill form
            fireEvent.change(screen.getByLabelText('Name'), {
                target: { value: 'John Doe' }
            });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'john@example.com' }
            });
            fireEvent.change(screen.getByLabelText('Subject'), {
                target: { value: 'Test subject' }
            });
            fireEvent.change(screen.getByLabelText('Message'), {
                target: { value: 'This is a test message with more than 20 characters' }
            });

            // Submit
            const submitButton = screen.getByRole('button', { name: 'Send message' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByRole('button', { name: 'Sending...' })).toBeInTheDocument();
            });
        });

        it('should show English success message when locale is "en"', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                json: async () => ({})
            });

            render(<ContactForm locale="en" />);

            // Fill form
            fireEvent.change(screen.getByLabelText('Name'), {
                target: { value: 'John Doe' }
            });
            fireEvent.change(screen.getByLabelText('Email'), {
                target: { value: 'john@example.com' }
            });
            fireEvent.change(screen.getByLabelText('Subject'), {
                target: { value: 'Test subject' }
            });
            fireEvent.change(screen.getByLabelText('Message'), {
                target: { value: 'This is a test message with more than 20 characters' }
            });

            // Submit
            const submitButton = screen.getByRole('button', { name: 'Send message' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(vi.mocked(addToast)).toHaveBeenCalledWith({
                    type: 'success',
                    message: 'Your message was sent successfully'
                });
            });
        });
    });

    describe('Accessibility', () => {
        it('should have aria-required on all input fields', () => {
            render(<ContactForm />);

            expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-required', 'true');
            expect(screen.getByLabelText('Email')).toHaveAttribute('aria-required', 'true');
            expect(screen.getByLabelText('Asunto')).toHaveAttribute('aria-required', 'true');
            expect(screen.getByLabelText('Mensaje')).toHaveAttribute('aria-required', 'true');
        });

        it('should have aria-invalid on fields when there are errors', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
                expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
                expect(screen.getByLabelText('Asunto')).toHaveAttribute('aria-invalid', 'true');
                expect(screen.getByLabelText('Mensaje')).toHaveAttribute('aria-invalid', 'true');
            });
        });

        it('should have aria-describedby on fields when there are errors', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

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

        it('should have role="alert" on error messages', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                const errors = screen.getAllByRole('alert');
                expect(errors.length).toBe(4);
            });
        });

        it('should have aria-live="polite" on error messages', async () => {
            const { container } = render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                const errorMessages = Array.from(container.querySelectorAll('[role="alert"]'));
                for (const error of errorMessages) {
                    expect(error).toHaveAttribute('aria-live', 'polite');
                }
            });
        });
    });

    describe('Styling', () => {
        it('should apply custom className to form', () => {
            const { container } = render(<ContactForm className="custom-form-class" />);

            const form = container.querySelector('form');
            expect(form).toHaveClass('custom-form-class');
        });

        it('should have proper spacing between form fields', () => {
            const { container } = render(<ContactForm />);

            const form = container.querySelector('form');
            expect(form?.className).toContain('space-y-4');
        });

        it('should apply error border color when field has error', async () => {
            render(<ContactForm />);

            const submitButton = screen.getByRole('button', { name: 'Enviar mensaje' });
            const form = submitButton.closest('form');
            if (form) fireEvent.submit(form);

            await waitFor(() => {
                const nameInput = screen.getByLabelText('Nombre');
                expect(nameInput.className).toContain('border-red-500');
            });
        });

        it('should apply normal border color when field has no error', () => {
            render(<ContactForm />);

            const nameInput = screen.getByLabelText('Nombre');
            expect(nameInput.className).toContain('border-gray-300');
        });
    });
});
