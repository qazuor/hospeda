/**
 * @file profile-preferences.test.tsx
 * @description Integration tests for ProfileEditForm.client.tsx and
 * PreferenceToggles.client.tsx.
 *
 * ProfileEditForm: initial field values, name/bio validation, loading state,
 *   API success/error toasts, character counter.
 * PreferenceToggles: initial checkbox state, toggle behaviour, language
 *   select, save notifications/language API calls, toast feedback.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => fallback ?? key,
        tPlural: (key: string, _n: number, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@sentry/astro', () => ({
    captureException: vi.fn()
}));

vi.mock('../../../src/lib/logger', () => ({
    webLogger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
}));

vi.mock('../../../src/store/toast-store', () => ({
    addToast: vi.fn()
}));

import { PreferenceToggles } from '../../../src/components/account/PreferenceToggles.client';
import { ProfileEditForm } from '../../../src/components/account/ProfileEditForm.client';
import { addToast } from '../../../src/store/toast-store';

const addToastMock = addToast as ReturnType<typeof vi.fn>;

// userApi mock — will be overridden per test via vi.spyOn
const mockPatchProfile = vi.fn();

vi.mock('../../../src/lib/api/endpoints-protected', () => ({
    userApi: {
        patchProfile: (...args: unknown[]) => mockPatchProfile(...args),
        getReviews: vi.fn(),
        getSubscription: vi.fn()
    },
    billingApi: {
        listPlans: vi.fn(),
        changePlan: vi.fn(),
        cancelSubscription: vi.fn(),
        reactivateSubscription: vi.fn(),
        createCheckout: vi.fn()
    },
    userBookmarksApi: {
        list: vi.fn(),
        delete: vi.fn()
    }
}));

beforeEach(() => {
    addToastMock.mockClear();
    mockPatchProfile.mockClear();
});

// ────────────────────────────────────────────────────────────
// ProfileEditForm
// ────────────────────────────────────────────────────────────

describe('ProfileEditForm.client.tsx', () => {
    const defaultProps = {
        userId: 'user-1',
        initialName: 'Jane Doe',
        initialBio: 'Travel enthusiast',
        email: 'jane@example.com',
        locale: 'es'
    };

    describe('Initial render', () => {
        it('should populate name input with initialName', () => {
            render(<ProfileEditForm {...defaultProps} />);
            expect(screen.getByDisplayValue('Jane Doe')).toBeInTheDocument();
        });

        it('should populate bio textarea with initialBio', () => {
            render(<ProfileEditForm {...defaultProps} />);
            expect(screen.getByDisplayValue('Travel enthusiast')).toBeInTheDocument();
        });

        it('should render the email input as read-only', () => {
            render(<ProfileEditForm {...defaultProps} />);
            const emailInput = screen.getByDisplayValue('jane@example.com');
            expect(emailInput).toHaveAttribute('readonly');
        });

        it('should render the email input as disabled', () => {
            render(<ProfileEditForm {...defaultProps} />);
            const emailInput = screen.getByDisplayValue('jane@example.com');
            expect(emailInput).toBeDisabled();
        });

        it('should show character count for bio', () => {
            render(<ProfileEditForm {...defaultProps} />);
            // Bio "Travel enthusiast" is 17 chars
            expect(screen.getByText('17/500')).toBeInTheDocument();
        });

        it('should render submit button', () => {
            render(<ProfileEditForm {...defaultProps} />);
            expect(screen.getByRole('button', { name: 'profileEdit.save' })).toBeInTheDocument();
        });
    });

    describe('Validation', () => {
        it('should show name required error when name is empty', async () => {
            render(<ProfileEditForm {...defaultProps} />);

            fireEvent.change(screen.getByDisplayValue('Jane Doe'), { target: { value: '' } });

            await act(async () => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            await waitFor(() => {
                expect(screen.getByText('profileEdit.validationNameRequired')).toBeInTheDocument();
            });
        });

        it('should show name too short error when name has 1 char', async () => {
            render(<ProfileEditForm {...defaultProps} />);

            fireEvent.change(screen.getByDisplayValue('Jane Doe'), { target: { value: 'J' } });

            await act(async () => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            await waitFor(() => {
                expect(screen.getByText('profileEdit.validationNameMinLength')).toBeInTheDocument();
            });
        });

        it('should show bio too long error when bio exceeds 500 chars', async () => {
            render(<ProfileEditForm {...defaultProps} />);

            const longBio = 'a'.repeat(501);
            fireEvent.change(screen.getByDisplayValue('Travel enthusiast'), {
                target: { value: longBio }
            });

            await act(async () => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            await waitFor(() => {
                expect(screen.getByText('profileEdit.validationBioMaxLength')).toBeInTheDocument();
            });
        });

        it('should NOT call patchProfile when validation fails', async () => {
            render(<ProfileEditForm {...defaultProps} />);
            fireEvent.change(screen.getByDisplayValue('Jane Doe'), { target: { value: '' } });

            await act(async () => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            expect(mockPatchProfile).not.toHaveBeenCalled();
        });

        it('should clear name error when user types a valid name', async () => {
            render(<ProfileEditForm {...defaultProps} />);
            fireEvent.change(screen.getByDisplayValue('Jane Doe'), { target: { value: '' } });

            await act(async () => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            await waitFor(() => {
                expect(screen.getByText('profileEdit.validationNameRequired')).toBeInTheDocument();
            });

            fireEvent.change(screen.getByRole('textbox', { name: /profileEdit.name/i }), {
                target: { value: 'Valid Name' }
            });

            await waitFor(() => {
                expect(
                    screen.queryByText('profileEdit.validationNameRequired')
                ).not.toBeInTheDocument();
            });
        });
    });

    describe('Successful submission', () => {
        it('should call patchProfile with trimmed name and bio', async () => {
            mockPatchProfile.mockResolvedValueOnce({ ok: true });
            render(<ProfileEditForm {...defaultProps} />);

            await act(async () => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            await waitFor(() => {
                expect(mockPatchProfile).toHaveBeenCalledWith({
                    id: 'user-1',
                    data: {
                        name: 'Jane Doe',
                        bio: 'Travel enthusiast'
                    }
                });
            });
        });

        it('should show success toast on successful save', async () => {
            mockPatchProfile.mockResolvedValueOnce({ ok: true });
            render(<ProfileEditForm {...defaultProps} />);

            await act(async () => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'success' })
                );
            });
        });

        it('should disable the submit button during submission', async () => {
            let resolvePromise!: (val: unknown) => void;
            mockPatchProfile.mockReturnValueOnce(
                new Promise((res) => {
                    resolvePromise = res;
                })
            );

            render(<ProfileEditForm {...defaultProps} />);
            const submitBtn = screen.getByRole('button', { name: 'profileEdit.save' });

            act(() => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            // During submission the button should be disabled
            await waitFor(() => expect(submitBtn).toBeDisabled());

            // Resolve the promise
            act(() => resolvePromise({ ok: true }));
            await waitFor(() => expect(submitBtn).not.toBeDisabled());
        });
    });

    describe('Failed submission', () => {
        it('should show error toast when API call fails', async () => {
            mockPatchProfile.mockRejectedValueOnce(new Error('Network error'));
            render(<ProfileEditForm {...defaultProps} />);

            await act(async () => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });
        });

        it('should show error toast when API returns ok=false', async () => {
            mockPatchProfile.mockResolvedValueOnce({ ok: false });
            render(<ProfileEditForm {...defaultProps} />);

            await act(async () => {
                fireEvent.submit(document.querySelector('form') as HTMLFormElement);
            });

            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });
        });
    });

    describe('Accessibility', () => {
        it('should have aria-required=true on name input', () => {
            render(<ProfileEditForm {...defaultProps} />);
            const nameInput = screen.getByRole('textbox', { name: /profileEdit.name/i });
            expect(nameInput).toHaveAttribute('aria-required', 'true');
        });

        it('should have aria-readonly=true on email input', () => {
            render(<ProfileEditForm {...defaultProps} />);
            const emailInput = screen.getByDisplayValue('jane@example.com');
            expect(emailInput).toHaveAttribute('aria-readonly', 'true');
        });
    });
});

// ────────────────────────────────────────────────────────────
// PreferenceToggles
// ────────────────────────────────────────────────────────────

const defaultNotifications = {
    enabled: true,
    allowEmails: true,
    allowSms: false,
    allowPush: true
};

describe('PreferenceToggles.client.tsx', () => {
    describe('Initial render', () => {
        it('should render notification checkboxes', () => {
            render(
                <PreferenceToggles
                    userId="user-1"
                    initialSettings={{ notifications: defaultNotifications }}
                />
            );
            expect(screen.getByLabelText(/preferences.emailLabel/)).toBeInTheDocument();
            expect(screen.getByLabelText(/preferences.smsLabel/)).toBeInTheDocument();
            expect(screen.getByLabelText(/preferences.pushLabel/)).toBeInTheDocument();
        });

        it('should render email checkbox as checked per initialSettings', () => {
            render(
                <PreferenceToggles
                    userId="user-1"
                    initialSettings={{ notifications: defaultNotifications }}
                />
            );
            expect(screen.getByLabelText(/preferences.emailLabel/)).toBeChecked();
        });

        it('should render sms checkbox as unchecked per initialSettings', () => {
            render(
                <PreferenceToggles
                    userId="user-1"
                    initialSettings={{ notifications: defaultNotifications }}
                />
            );
            expect(screen.getByLabelText(/preferences.smsLabel/)).not.toBeChecked();
        });

        it('should render the language select with initial language', () => {
            render(
                <PreferenceToggles
                    userId="user-1"
                    initialSettings={{
                        language: 'en',
                        notifications: defaultNotifications
                    }}
                    locale="en"
                />
            );
            const select = screen.getByRole('combobox');
            expect((select as HTMLSelectElement).value).toBe('en');
        });
    });

    describe('Notification toggles', () => {
        it('should toggle SMS checkbox when clicked', () => {
            render(
                <PreferenceToggles
                    userId="user-1"
                    initialSettings={{ notifications: defaultNotifications }}
                />
            );
            const smsCheckbox = screen.getByLabelText(/preferences.smsLabel/);
            expect(smsCheckbox).not.toBeChecked();
            fireEvent.click(smsCheckbox);
            expect(smsCheckbox).toBeChecked();
        });

        it('should uncheck email when it was checked', () => {
            render(
                <PreferenceToggles
                    userId="user-1"
                    initialSettings={{ notifications: defaultNotifications }}
                />
            );
            const emailCheckbox = screen.getByLabelText(/preferences.emailLabel/);
            expect(emailCheckbox).toBeChecked();
            fireEvent.click(emailCheckbox);
            expect(emailCheckbox).not.toBeChecked();
        });
    });

    describe('Save notifications', () => {
        it('should call patchProfile with notifications when save button is clicked', async () => {
            mockPatchProfile.mockResolvedValueOnce({ ok: true });

            render(
                <PreferenceToggles
                    userId="user-1"
                    initialSettings={{ notifications: defaultNotifications }}
                />
            );

            const saveButtons = screen.getAllByText('preferences.saveButton');
            const notifSaveBtn = saveButtons[0];
            if (!notifSaveBtn) throw new Error('Save button not found');

            await act(async () => {
                fireEvent.click(notifSaveBtn);
            });

            expect(mockPatchProfile).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'user-1',
                    data: expect.objectContaining({ settings: expect.any(Object) })
                })
            );
        });

        it('should show success toast after saving notifications', async () => {
            mockPatchProfile.mockResolvedValueOnce({ ok: true });

            render(
                <PreferenceToggles
                    userId="user-1"
                    initialSettings={{ notifications: defaultNotifications }}
                />
            );

            const saveButtons = screen.getAllByText('preferences.saveButton');
            await act(async () => {
                fireEvent.click(saveButtons[0] as HTMLButtonElement);
            });

            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'success' })
                );
            });
        });

        it('should show error toast when saving notifications fails', async () => {
            mockPatchProfile.mockRejectedValueOnce(new Error('API error'));

            render(
                <PreferenceToggles
                    userId="user-1"
                    initialSettings={{ notifications: defaultNotifications }}
                />
            );

            const saveButtons = screen.getAllByText('preferences.saveButton');
            await act(async () => {
                fireEvent.click(saveButtons[0] as HTMLButtonElement);
            });

            await waitFor(() => {
                expect(addToastMock).toHaveBeenCalledWith(
                    expect.objectContaining({ type: 'error' })
                );
            });
        });
    });

    describe('Language select', () => {
        it('should update language state when select changes', () => {
            render(
                <PreferenceToggles
                    userId="user-1"
                    initialSettings={{ language: 'es', notifications: defaultNotifications }}
                    locale="es"
                />
            );
            const select = screen.getByRole('combobox');
            fireEvent.change(select, { target: { value: 'en' } });
            expect((select as HTMLSelectElement).value).toBe('en');
        });

        it('should have es, en, pt as language options', () => {
            render(
                <PreferenceToggles
                    userId="user-1"
                    initialSettings={{ notifications: defaultNotifications }}
                />
            );
            const options = screen.getAllByRole('option');
            const values = options.map((o) => (o as HTMLOptionElement).value);
            expect(values).toContain('es');
            expect(values).toContain('en');
            expect(values).toContain('pt');
        });
    });
});
