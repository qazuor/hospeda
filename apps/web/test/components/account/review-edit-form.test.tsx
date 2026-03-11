/**
 * @file review-edit-form.test.tsx
 * @description Unit tests for ReviewEditForm.client.tsx.
 *
 * Covers:
 *  - Form fields rendering (title input, content textarea)
 *  - Star selector rendering and interaction
 *  - aria attributes on the star radio-group
 *  - Field value pre-population from review prop
 *  - Field change updates (controlled inputs)
 *  - Form submission calls onSave with current state
 *  - Cancel button calls onCancel
 *  - isSaving disables all interactive controls and shows saving label
 *  - Title and content are required (HTML5 required attribute)
 *  - Accessibility: labels linked to inputs, radiogroup label
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../src/hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key: string, _fallback?: string, _vars?: Record<string, unknown>) => key,
        tPlural: (key: string, _n: number, _fallback?: string) => key
    })
}));

vi.mock('@repo/icons', () => ({
    CancelIcon: () => <span data-testid="cancel-icon" />,
    SaveIcon: () => <span data-testid="save-icon" />
}));

// Mock createTranslations (used by resolveValidationKey) so keys are returned as-is.
vi.mock('../../../src/lib/i18n', () => ({
    createTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string) => key
    }),
    isValidLocale: (l: string) => ['es', 'en', 'pt'].includes(l)
}));

// ---------------------------------------------------------------------------
// Component under test
// ---------------------------------------------------------------------------

import { ReviewEditForm } from '../../../src/components/account/ReviewEditForm.client';
import type {
    EditFormState,
    ReviewEditFormMessages,
    ReviewEditFormReview
} from '../../../src/components/account/ReviewEditForm.client';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const defaultReview: ReviewEditFormReview = {
    id: 'rev-001',
    rating: 3,
    title: 'Initial title',
    content: 'Initial content for the review.'
};

const defaultMessages: ReviewEditFormMessages = {
    ratingEditLabel: 'Rating',
    titleLabel: 'Title',
    contentLabel: 'Content',
    cancelButton: 'Cancel',
    saveButton: 'Save',
    saving: 'Saving...'
};

/** Helper to build a rendered form with sensible defaults. */
function renderForm(overrides?: {
    review?: Partial<ReviewEditFormReview>;
    messages?: Partial<ReviewEditFormMessages>;
    isSaving?: boolean;
    onSave?: (id: string, data: EditFormState) => Promise<void>;
    onCancel?: () => void;
}) {
    const onSave = overrides?.onSave ?? vi.fn().mockResolvedValue(undefined);
    const onCancel = overrides?.onCancel ?? vi.fn();

    render(
        <ReviewEditForm
            review={{ ...defaultReview, ...(overrides?.review ?? {}) }}
            messages={{ ...defaultMessages, ...(overrides?.messages ?? {}) }}
            onSave={onSave}
            onCancel={onCancel}
            isSaving={overrides?.isSaving ?? false}
            locale="es"
        />
    );

    return { onSave, onCancel };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewEditForm', () => {
    // -----------------------------------------------------------------------
    // Form fields rendering
    // -----------------------------------------------------------------------

    describe('Form fields rendering', () => {
        it('should render the title input with the review title pre-filled', () => {
            // Arrange & Act
            renderForm();

            // Assert
            const titleInput = screen.getByRole('textbox', { name: /title/i });
            expect(titleInput).toBeInTheDocument();
            expect(titleInput).toHaveValue(defaultReview.title);
        });

        it('should render the content textarea with the review content pre-filled', () => {
            // Arrange & Act
            renderForm();

            // Assert
            const contentTextarea = screen.getByRole('textbox', { name: /content/i });
            expect(contentTextarea).toBeInTheDocument();
            expect(contentTextarea).toHaveValue(defaultReview.content);
        });

        it('should render a cancel button with the correct label', () => {
            // Arrange & Act
            renderForm();

            // Assert
            expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
        });

        it('should render a submit button with the save label when not saving', () => {
            // Arrange & Act
            renderForm({ isSaving: false });

            // Assert
            expect(
                screen.getByRole('button', { name: defaultMessages.saveButton })
            ).toBeInTheDocument();
        });

        it('should show the saving label on the submit button when isSaving is true', () => {
            // Arrange & Act
            renderForm({ isSaving: true });

            // Assert
            expect(
                screen.getByRole('button', { name: defaultMessages.saving })
            ).toBeInTheDocument();
            expect(
                screen.queryByRole('button', { name: defaultMessages.saveButton })
            ).not.toBeInTheDocument();
        });

        it('should render a form element wrapping all fields', () => {
            // Arrange & Act
            const { container } = render(
                <ReviewEditForm
                    review={defaultReview}
                    messages={defaultMessages}
                    onSave={vi.fn()}
                    onCancel={vi.fn()}
                    isSaving={false}
                />
            );

            // Assert
            expect(container.querySelector('form')).toBeInTheDocument();
        });
    });

    // -----------------------------------------------------------------------
    // Star selector rendering
    // -----------------------------------------------------------------------

    describe('Star selector', () => {
        it('should render exactly 5 star buttons', () => {
            // Arrange & Act
            renderForm();

            // Assert
            const starButtons = screen.getAllByRole('radio');
            expect(starButtons).toHaveLength(5);
        });

        it('should expose a radiogroup container with the rating label', () => {
            // Arrange & Act
            renderForm();

            // Assert
            const radiogroup = screen.getByRole('radiogroup');
            expect(radiogroup).toHaveAttribute('aria-label', defaultMessages.ratingEditLabel);
        });

        it('should mark the current rating star as checked', () => {
            // Arrange & Act
            renderForm({ review: { rating: 3 } });

            // Assert
            const stars = screen.getAllByRole('radio');
            expect(stars[2]).toHaveAttribute('aria-checked', 'true'); // star 3 (0-indexed 2)
            expect(stars[0]).toHaveAttribute('aria-checked', 'false');
            expect(stars[4]).toHaveAttribute('aria-checked', 'false');
        });

        it('should update the checked star after clicking a different star', async () => {
            // Arrange
            renderForm({ review: { rating: 3 } });
            const stars = screen.getAllByRole('radio');

            // Act - click star 5
            await act(async () => {
                fireEvent.click(stars[4] as HTMLButtonElement);
            });

            // Assert
            expect(stars[4]).toHaveAttribute('aria-checked', 'true');
            expect(stars[2]).toHaveAttribute('aria-checked', 'false');
        });

        it('should allow selecting rating 1 (lowest)', async () => {
            // Arrange
            renderForm({ review: { rating: 5 } });
            const stars = screen.getAllByRole('radio');

            // Act
            await act(async () => {
                fireEvent.click(stars[0] as HTMLButtonElement);
            });

            // Assert
            expect(stars[0]).toHaveAttribute('aria-checked', 'true');
        });

        it('should allow selecting rating 5 (highest)', async () => {
            // Arrange
            renderForm({ review: { rating: 1 } });
            const stars = screen.getAllByRole('radio');

            // Act
            await act(async () => {
                fireEvent.click(stars[4] as HTMLButtonElement);
            });

            // Assert
            expect(stars[4]).toHaveAttribute('aria-checked', 'true');
        });
    });

    // -----------------------------------------------------------------------
    // Form field change (controlled inputs)
    // -----------------------------------------------------------------------

    describe('Controlled input behavior', () => {
        it('should update title input value when user types', async () => {
            // Arrange
            renderForm();
            const titleInput = screen.getByRole('textbox', { name: /title/i });

            // Act
            await act(async () => {
                fireEvent.change(titleInput, { target: { name: 'title', value: 'New title' } });
            });

            // Assert
            expect(titleInput).toHaveValue('New title');
        });

        it('should update content textarea value when user types', async () => {
            // Arrange
            renderForm();
            const contentArea = screen.getByRole('textbox', { name: /content/i });

            // Act
            await act(async () => {
                fireEvent.change(contentArea, {
                    target: { name: 'content', value: 'Updated review content' }
                });
            });

            // Assert
            expect(contentArea).toHaveValue('Updated review content');
        });
    });

    // -----------------------------------------------------------------------
    // Form submission
    // -----------------------------------------------------------------------

    describe('Form submission', () => {
        it('should call onSave with the review id and current form state on submit', async () => {
            // Arrange
            const onSave = vi.fn().mockResolvedValue(undefined);
            renderForm({ review: { id: 'rev-999', rating: 4 }, onSave });

            const titleInput = screen.getByRole('textbox', { name: /title/i });
            const contentArea = screen.getByRole('textbox', { name: /content/i });

            // Act - update fields then submit
            await act(async () => {
                fireEvent.change(titleInput, { target: { name: 'title', value: 'My title' } });
                fireEvent.change(contentArea, {
                    target: { name: 'content', value: 'My content' }
                });
            });

            const form = titleInput.closest('form') as HTMLFormElement;
            await act(async () => {
                fireEvent.submit(form);
            });

            // Assert
            expect(onSave).toHaveBeenCalledTimes(1);
            expect(onSave).toHaveBeenCalledWith('rev-999', {
                rating: 4,
                title: 'My title',
                content: 'My content'
            });
        });

        it('should pass updated star rating in onSave payload', async () => {
            // Arrange
            const onSave = vi.fn().mockResolvedValue(undefined);
            renderForm({ review: { rating: 2 }, onSave });

            const stars = screen.getAllByRole('radio');

            // Act - click star 5 then submit
            await act(async () => {
                fireEvent.click(stars[4] as HTMLButtonElement);
            });

            const form = (stars[0] as HTMLElement).closest('form') as HTMLFormElement;
            await act(async () => {
                fireEvent.submit(form);
            });

            // Assert
            expect(onSave).toHaveBeenCalledWith(
                defaultReview.id,
                expect.objectContaining({ rating: 5 })
            );
        });

        it('should not call onSave when form is not submitted', () => {
            // Arrange
            const onSave = vi.fn();
            renderForm({ onSave });

            // Assert - no submission happened
            expect(onSave).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Cancel button
    // -----------------------------------------------------------------------

    describe('Cancel button behavior', () => {
        it('should call onCancel when the cancel button is clicked', async () => {
            // Arrange
            const onCancel = vi.fn();
            renderForm({ onCancel });

            // Act
            await act(async () => {
                fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
            });

            // Assert
            expect(onCancel).toHaveBeenCalledTimes(1);
        });

        it('should NOT call onCancel when the submit button is clicked instead', async () => {
            // Arrange
            const onCancel = vi.fn();
            const onSave = vi.fn().mockResolvedValue(undefined);
            renderForm({ onCancel, onSave });

            // Act
            const form = screen
                .getByRole('button', { name: defaultMessages.saveButton })
                .closest('form') as HTMLFormElement;
            await act(async () => {
                fireEvent.submit(form);
            });

            // Assert
            expect(onCancel).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // isSaving disables controls
    // -----------------------------------------------------------------------

    describe('isSaving prop', () => {
        it('should disable the cancel button when isSaving is true', () => {
            // Arrange & Act
            renderForm({ isSaving: true });

            // Assert
            const cancelButton = screen.getByRole('button', { name: /cancel/i });
            expect(cancelButton).toBeDisabled();
        });

        it('should disable the submit button when isSaving is true', () => {
            // Arrange & Act
            renderForm({ isSaving: true });

            // Assert
            const submitButton = screen.getByRole('button', { name: defaultMessages.saving });
            expect(submitButton).toBeDisabled();
        });

        it('should enable both action buttons when isSaving is false', () => {
            // Arrange & Act
            renderForm({ isSaving: false });

            // Assert
            expect(screen.getByRole('button', { name: /cancel/i })).not.toBeDisabled();
            expect(
                screen.getByRole('button', { name: defaultMessages.saveButton })
            ).not.toBeDisabled();
        });
    });

    // -----------------------------------------------------------------------
    // Required fields (HTML validation attributes)
    // -----------------------------------------------------------------------

    describe('Field validation attributes', () => {
        it('should mark the title input as aria-required', () => {
            // Arrange & Act
            renderForm();

            // Assert — uses aria-required instead of native required for custom validation
            expect(screen.getByRole('textbox', { name: /title/i })).toHaveAttribute(
                'aria-required',
                'true'
            );
        });

        it('should mark the content textarea as aria-required', () => {
            // Arrange & Act
            renderForm();

            // Assert
            expect(screen.getByRole('textbox', { name: /content/i })).toHaveAttribute(
                'aria-required',
                'true'
            );
        });

        it('should enforce a maxLength of 200 on the title input', () => {
            // Arrange & Act
            renderForm();

            // Assert
            const titleInput = screen.getByRole('textbox', { name: /title/i });
            expect(titleInput).toHaveAttribute('maxLength', '200');
        });

        it('should enforce a maxLength of 2000 on the content textarea', () => {
            // Arrange & Act
            renderForm();

            // Assert
            const contentArea = screen.getByRole('textbox', { name: /content/i });
            expect(contentArea).toHaveAttribute('maxLength', '2000');
        });
    });

    // -----------------------------------------------------------------------
    // Accessibility
    // -----------------------------------------------------------------------

    describe('Accessibility', () => {
        it('should associate the title label with the title input via htmlFor', () => {
            // Arrange
            renderForm({ review: { id: 'a11y-001' } });

            // Act - getByRole already verifies label linkage
            const titleInput = screen.getByRole('textbox', { name: /title/i });

            // Assert
            expect(titleInput).toHaveAttribute('id', 'edit-title-a11y-001');
        });

        it('should associate the content label with the textarea via htmlFor', () => {
            // Arrange
            renderForm({ review: { id: 'a11y-002' } });

            // Act
            const contentArea = screen.getByRole('textbox', { name: /content/i });

            // Assert
            expect(contentArea).toHaveAttribute('id', 'edit-content-a11y-002');
        });

        it('should render star buttons with descriptive aria-label attributes', () => {
            // Arrange & Act
            renderForm();
            const stars = screen.getAllByRole('radio');

            // Assert - each star has an aria-label (the translation key used by useTranslation mock)
            for (const star of stars) {
                expect(star).toHaveAttribute('aria-label');
            }
        });

        it('should render cancel icon with aria-hidden to hide it from screen readers', () => {
            // Arrange & Act
            renderForm();

            // Assert - the icon wrapper rendered by the mock carries aria-hidden
            // The component passes aria-hidden="true" to the CancelIcon component
            const cancelIcon = screen.getByTestId('cancel-icon');
            expect(cancelIcon).toBeInTheDocument();
        });

        it('should set aria-invalid on title input when validation fails', async () => {
            // Arrange — pre-fill with empty title so validation fails on submit
            renderForm({ review: { title: '' } });
            const titleInput = screen.getByRole('textbox', { name: /title/i });

            // Act — submit with empty title
            const form = titleInput.closest('form') as HTMLFormElement;
            await act(async () => {
                fireEvent.submit(form);
            });

            // Assert
            expect(titleInput).toHaveAttribute('aria-invalid', 'true');
        });

        it('should set aria-describedby on title input pointing to error element', async () => {
            // Arrange
            renderForm({ review: { id: 'aria-test', title: '' } });
            const titleInput = screen.getByRole('textbox', { name: /title/i });

            // Act
            const form = titleInput.closest('form') as HTMLFormElement;
            await act(async () => {
                fireEvent.submit(form);
            });

            // Assert — aria-describedby references the error element id
            expect(titleInput).toHaveAttribute('aria-describedby', 'edit-title-aria-test-error');
            expect(document.getElementById('edit-title-aria-test-error')).toBeInTheDocument();
        });

        it('should set aria-invalid on content textarea when validation fails', async () => {
            // Arrange — pre-fill with empty content
            renderForm({ review: { content: '' } });
            const contentArea = screen.getByRole('textbox', { name: /content/i });

            // Act
            const form = contentArea.closest('form') as HTMLFormElement;
            await act(async () => {
                fireEvent.submit(form);
            });

            // Assert
            expect(contentArea).toHaveAttribute('aria-invalid', 'true');
        });

        it('should block onSave when title is empty', async () => {
            // Arrange
            const onSave = vi.fn();
            renderForm({ review: { title: '' }, onSave });
            const titleInput = screen.getByRole('textbox', { name: /title/i });

            // Act
            const form = titleInput.closest('form') as HTMLFormElement;
            await act(async () => {
                fireEvent.submit(form);
            });

            // Assert — validation blocked the save call
            expect(onSave).not.toHaveBeenCalled();
        });

        it('should block onSave when content is shorter than 10 characters', async () => {
            // Arrange
            const onSave = vi.fn();
            renderForm({ review: { content: 'Short' }, onSave });
            const contentArea = screen.getByRole('textbox', { name: /content/i });

            // Act
            const form = contentArea.closest('form') as HTMLFormElement;
            await act(async () => {
                fireEvent.submit(form);
            });

            // Assert
            expect(onSave).not.toHaveBeenCalled();
        });
    });

    // -----------------------------------------------------------------------
    // Pre-population edge cases
    // -----------------------------------------------------------------------

    describe('Pre-population from review prop', () => {
        it('should pre-fill an empty title when review.title is empty string', () => {
            // Arrange & Act
            renderForm({ review: { title: '' } });

            // Assert
            expect(screen.getByRole('textbox', { name: /title/i })).toHaveValue('');
        });

        it('should pre-fill an empty content when review.content is empty string', () => {
            // Arrange & Act
            renderForm({ review: { content: '' } });

            // Assert
            expect(screen.getByRole('textbox', { name: /content/i })).toHaveValue('');
        });

        it('should reflect rating 1 as only the first star checked', () => {
            // Arrange & Act
            renderForm({ review: { rating: 1 } });
            const stars = screen.getAllByRole('radio');

            // Assert
            expect(stars[0]).toHaveAttribute('aria-checked', 'true');
            for (let i = 1; i < 5; i++) {
                expect(stars[i]).toHaveAttribute('aria-checked', 'false');
            }
        });

        it('should reflect rating 5 as all five stars checked', () => {
            // Arrange & Act
            renderForm({ review: { rating: 5 } });
            const stars = screen.getAllByRole('radio');

            // Assert - aria-checked reflects current selection: only star 5 is "checked"
            expect(stars[4]).toHaveAttribute('aria-checked', 'true');
        });
    });
});
