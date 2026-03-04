import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReviewForm } from '../../../src/components/review/ReviewForm.client';

describe('ReviewForm.client.tsx', () => {
    const defaultProps = {
        entityId: 'test-123',
        entityType: 'accommodation' as const
    };

    describe('Props', () => {
        it('should accept entityId prop', () => {
            const { container } = render(<ReviewForm {...defaultProps} />);
            const form = container.querySelector('form');
            expect(form).toHaveAttribute('data-entity-id', 'test-123');
        });

        it('should accept entityType prop', () => {
            const { container } = render(<ReviewForm {...defaultProps} />);
            const form = container.querySelector('form');
            expect(form).toHaveAttribute('data-entity-type', 'accommodation');
        });

        it('should default locale to "es"', () => {
            render(<ReviewForm {...defaultProps} />);
            expect(screen.getByText('Calificación')).toBeInTheDocument();
            expect(screen.getByText('Enviar reseña')).toBeInTheDocument();
        });

        it('should accept locale prop and display English labels', () => {
            render(
                <ReviewForm
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByText('Rating')).toBeInTheDocument();
            expect(screen.getByText('Submit review')).toBeInTheDocument();
        });

        it('should accept onSubmit callback', () => {
            const handleSubmit = vi.fn();
            render(
                <ReviewForm
                    {...defaultProps}
                    onSubmit={handleSubmit}
                />
            );
            expect(handleSubmit).not.toHaveBeenCalled();
        });

        it('should accept onCancel callback', () => {
            const handleCancel = vi.fn();
            render(
                <ReviewForm
                    {...defaultProps}
                    onCancel={handleCancel}
                />
            );
            expect(handleCancel).not.toHaveBeenCalled();
        });

        it('should accept className prop', () => {
            const { container } = render(
                <ReviewForm
                    {...defaultProps}
                    className="custom-class"
                />
            );
            const form = container.querySelector('form');
            expect(form).toHaveClass('custom-class');
        });
    });

    describe('Rendering', () => {
        it('should render all form fields', () => {
            render(<ReviewForm {...defaultProps} />);

            // Rating field
            expect(screen.getByText('Calificación')).toBeInTheDocument();
            const stars = screen.getAllByLabelText(/Calificar \d estrella/);
            expect(stars).toHaveLength(5);

            // Title field
            expect(screen.getByLabelText('Título')).toBeInTheDocument();

            // Content field
            expect(screen.getByLabelText('Comentario')).toBeInTheDocument();
        });

        it('should render submit button', () => {
            render(<ReviewForm {...defaultProps} />);
            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            expect(submitButton).toBeInTheDocument();
            expect(submitButton).toHaveAttribute('type', 'submit');
        });

        it('should render cancel button when onCancel is provided', () => {
            render(
                <ReviewForm
                    {...defaultProps}
                    onCancel={vi.fn()}
                />
            );
            const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
            expect(cancelButton).toBeInTheDocument();
            expect(cancelButton).toHaveAttribute('type', 'button');
        });

        it('should not render cancel button when onCancel is not provided', () => {
            render(<ReviewForm {...defaultProps} />);
            const cancelButton = screen.queryByRole('button', { name: 'Cancelar' });
            expect(cancelButton).not.toBeInTheDocument();
        });

        it('should render 5 stars for rating', () => {
            render(<ReviewForm {...defaultProps} />);
            const stars = screen.getAllByLabelText(/Calificar \d estrella/);
            expect(stars).toHaveLength(5);
        });

        it('should render title input with placeholder', () => {
            render(<ReviewForm {...defaultProps} />);
            const titleInput = screen.getByLabelText('Título');
            expect(titleInput).toHaveAttribute('placeholder', 'Resumen de tu experiencia');
        });

        it('should render content textarea with placeholder', () => {
            render(<ReviewForm {...defaultProps} />);
            const contentTextarea = screen.getByLabelText('Comentario');
            expect(contentTextarea).toHaveAttribute(
                'placeholder',
                'Comparte tu experiencia en detalle...'
            );
        });
    });

    describe('Star Rating Interaction', () => {
        it('should select rating when star is clicked', () => {
            render(<ReviewForm {...defaultProps} />);
            const thirdStar = screen.getByLabelText('Calificar 3 estrella(s)');
            fireEvent.click(thirdStar);

            // Stars should be filled up to the clicked one (check for filled star token class)
            const stars = screen.getAllByLabelText(/Calificar \d estrella/);
            const filledStars = stars.filter((star) => {
                const svg = star.querySelector('svg');
                const cls = svg?.getAttribute('class') ?? '';
                return cls.includes('text-star') && !cls.includes('text-star-empty');
            });
            expect(filledStars).toHaveLength(3);
        });

        it('should update rating when different star is clicked', () => {
            render(<ReviewForm {...defaultProps} />);

            const secondStar = screen.getByLabelText('Calificar 2 estrella(s)');
            fireEvent.click(secondStar);

            const fifthStar = screen.getByLabelText('Calificar 5 estrella(s)');
            fireEvent.click(fifthStar);

            const stars = screen.getAllByLabelText(/Calificar \d estrella/);
            const filledStars = stars.filter((star) => {
                const svg = star.querySelector('svg');
                const cls = svg?.getAttribute('class') ?? '';
                return cls.includes('text-star') && !cls.includes('text-star-empty');
            });
            expect(filledStars).toHaveLength(5);
        });

        it('should show visual hover state on stars', () => {
            render(<ReviewForm {...defaultProps} />);
            const fourthStar = screen.getByLabelText('Calificar 4 estrella(s)');

            fireEvent.mouseEnter(fourthStar);

            const stars = screen.getAllByLabelText(/Calificar \d estrella/);
            const hoveredStars = stars.filter((star, index) => {
                const svg = star.querySelector('svg');
                const cls = svg?.getAttribute('class') ?? '';
                return index < 4 && cls.includes('text-star') && !cls.includes('text-star-empty');
            });
            expect(hoveredStars).toHaveLength(4);
        });

        it('should clear hover state when mouse leaves', () => {
            render(<ReviewForm {...defaultProps} />);
            const thirdStar = screen.getByLabelText('Calificar 3 estrella(s)');

            fireEvent.mouseEnter(thirdStar);
            fireEvent.mouseLeave(thirdStar);

            const stars = screen.getAllByLabelText(/Calificar \d estrella/);
            const filledStars = stars.filter((star) => {
                const svg = star.querySelector('svg');
                const cls = svg?.getAttribute('class') ?? '';
                return cls.includes('text-star') && !cls.includes('text-star-empty');
            });
            expect(filledStars).toHaveLength(0);
        });
    });

    describe('Form Validation', () => {
        it('should show rating error when submitting without rating', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('Debes seleccionar una calificación')).toBeInTheDocument();
            });
        });

        it('should show title error when submitting without title', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('El título es requerido')).toBeInTheDocument();
            });
        });

        it('should show title error when title is less than 3 characters', async () => {
            render(<ReviewForm {...defaultProps} />);

            const titleInput = screen.getByLabelText('Título');
            fireEvent.change(titleInput, { target: { value: 'ab' } });

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(
                    screen.getByText('El título debe tener al menos 3 caracteres')
                ).toBeInTheDocument();
            });
        });

        it('should show content error when submitting without content', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('El comentario es requerido')).toBeInTheDocument();
            });
        });

        it('should show content error when content is less than 10 characters', async () => {
            render(<ReviewForm {...defaultProps} />);

            const contentTextarea = screen.getByLabelText('Comentario');
            fireEvent.change(contentTextarea, { target: { value: 'short' } });

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(
                    screen.getByText('El comentario debe tener al menos 10 caracteres')
                ).toBeInTheDocument();
            });
        });

        it('should show all validation errors when form is empty', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('Debes seleccionar una calificación')).toBeInTheDocument();
                expect(screen.getByText('El título es requerido')).toBeInTheDocument();
                expect(screen.getByText('El comentario es requerido')).toBeInTheDocument();
            });
        });

        it('should clear rating error when star is clicked', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('Debes seleccionar una calificación')).toBeInTheDocument();
            });

            const firstStar = screen.getByLabelText('Calificar 1 estrella(s)');
            fireEvent.click(firstStar);

            await waitFor(() => {
                expect(
                    screen.queryByText('Debes seleccionar una calificación')
                ).not.toBeInTheDocument();
            });
        });

        it('should clear title error when user types', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('El título es requerido')).toBeInTheDocument();
            });

            const titleInput = screen.getByLabelText('Título');
            fireEvent.change(titleInput, { target: { value: 'Great place' } });

            await waitFor(() => {
                expect(screen.queryByText('El título es requerido')).not.toBeInTheDocument();
            });
        });

        it('should clear content error when user types', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('El comentario es requerido')).toBeInTheDocument();
            });

            const contentTextarea = screen.getByLabelText('Comentario');
            fireEvent.change(contentTextarea, {
                target: { value: 'This is a great place to stay' }
            });

            await waitFor(() => {
                expect(screen.queryByText('El comentario es requerido')).not.toBeInTheDocument();
            });
        });
    });

    describe('Form Submission', () => {
        it('should call onSubmit with correct data when form is valid', async () => {
            const handleSubmit = vi.fn();
            render(
                <ReviewForm
                    {...defaultProps}
                    onSubmit={handleSubmit}
                />
            );

            // Fill form
            const thirdStar = screen.getByLabelText('Calificar 3 estrella(s)');
            fireEvent.click(thirdStar);

            const titleInput = screen.getByLabelText('Título');
            fireEvent.change(titleInput, { target: { value: 'Great stay' } });

            const contentTextarea = screen.getByLabelText('Comentario');
            fireEvent.change(contentTextarea, {
                target: { value: 'This is a wonderful place to stay. Highly recommended!' }
            });

            // Submit form
            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(handleSubmit).toHaveBeenCalledTimes(1);
                expect(handleSubmit).toHaveBeenCalledWith({
                    rating: 3,
                    title: 'Great stay',
                    content: 'This is a wonderful place to stay. Highly recommended!'
                });
            });
        });

        it('should trim whitespace from title and content', async () => {
            const handleSubmit = vi.fn();
            render(
                <ReviewForm
                    {...defaultProps}
                    onSubmit={handleSubmit}
                />
            );

            const firstStar = screen.getByLabelText('Calificar 1 estrella(s)');
            fireEvent.click(firstStar);

            const titleInput = screen.getByLabelText('Título');
            fireEvent.change(titleInput, { target: { value: '  Title with spaces  ' } });

            const contentTextarea = screen.getByLabelText('Comentario');
            fireEvent.change(contentTextarea, {
                target: { value: '  Content with spaces  ' }
            });

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(handleSubmit).toHaveBeenCalledWith({
                    rating: 1,
                    title: 'Title with spaces',
                    content: 'Content with spaces'
                });
            });
        });

        it('should not call onSubmit when form is invalid', async () => {
            const handleSubmit = vi.fn();
            render(
                <ReviewForm
                    {...defaultProps}
                    onSubmit={handleSubmit}
                />
            );

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(handleSubmit).not.toHaveBeenCalled();
            });
        });

        it('should prevent default form submission', () => {
            const handleSubmit = vi.fn();
            render(
                <ReviewForm
                    {...defaultProps}
                    onSubmit={handleSubmit}
                />
            );

            const form = screen.getByRole('button', { name: 'Enviar reseña' }).closest('form');
            const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
            const preventDefaultSpy = vi.spyOn(submitEvent, 'preventDefault');

            form?.dispatchEvent(submitEvent);

            expect(preventDefaultSpy).toHaveBeenCalled();
        });
    });

    describe('Cancel Button', () => {
        it('should call onCancel when cancel button is clicked', () => {
            const handleCancel = vi.fn();
            render(
                <ReviewForm
                    {...defaultProps}
                    onCancel={handleCancel}
                />
            );

            const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
            fireEvent.click(cancelButton);

            expect(handleCancel).toHaveBeenCalledTimes(1);
        });

        it('should have type="button" to prevent form submission', () => {
            render(
                <ReviewForm
                    {...defaultProps}
                    onCancel={vi.fn()}
                />
            );
            const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
            expect(cancelButton).toHaveAttribute('type', 'button');
        });
    });

    describe('Locale Switching', () => {
        it('should display Spanish labels when locale is "es"', () => {
            render(
                <ReviewForm
                    {...defaultProps}
                    locale="es"
                />
            );

            expect(screen.getByText('Calificación')).toBeInTheDocument();
            expect(screen.getByText('Título')).toBeInTheDocument();
            expect(screen.getByText('Comentario')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Enviar reseña' })).toBeInTheDocument();
        });

        it('should display English labels when locale is "en"', () => {
            render(
                <ReviewForm
                    {...defaultProps}
                    locale="en"
                />
            );

            expect(screen.getByText('Rating')).toBeInTheDocument();
            expect(screen.getByText('Title')).toBeInTheDocument();
            expect(screen.getByText('Review')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Submit review' })).toBeInTheDocument();
        });

        it('should display Spanish placeholders when locale is "es"', () => {
            render(
                <ReviewForm
                    {...defaultProps}
                    locale="es"
                />
            );

            const titleInput = screen.getByLabelText('Título');
            expect(titleInput).toHaveAttribute('placeholder', 'Resumen de tu experiencia');

            const contentTextarea = screen.getByLabelText('Comentario');
            expect(contentTextarea).toHaveAttribute(
                'placeholder',
                'Comparte tu experiencia en detalle...'
            );
        });

        it('should display English placeholders when locale is "en"', () => {
            render(
                <ReviewForm
                    {...defaultProps}
                    locale="en"
                />
            );

            const titleInput = screen.getByLabelText('Title');
            expect(titleInput).toHaveAttribute('placeholder', 'Summary of your experience');

            const contentTextarea = screen.getByLabelText('Review');
            expect(contentTextarea).toHaveAttribute(
                'placeholder',
                'Share your experience in detail...'
            );
        });

        it('should display localized error messages in Spanish', async () => {
            render(
                <ReviewForm
                    {...defaultProps}
                    locale="es"
                />
            );

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('Debes seleccionar una calificación')).toBeInTheDocument();
                expect(screen.getByText('El título es requerido')).toBeInTheDocument();
                expect(screen.getByText('El comentario es requerido')).toBeInTheDocument();
            });
        });

        it('should display localized error messages in English', async () => {
            render(
                <ReviewForm
                    {...defaultProps}
                    locale="en"
                />
            );

            const submitButton = screen.getByRole('button', { name: 'Submit review' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText('You must select a rating')).toBeInTheDocument();
                expect(screen.getByText('Title is required')).toBeInTheDocument();
                expect(screen.getByText('Review is required')).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have aria-required on rating field', () => {
            const { container } = render(<ReviewForm {...defaultProps} />);
            const ratingGroup = container.querySelector('[role="radiogroup"]');
            expect(ratingGroup).toHaveAttribute('aria-required', 'true');
        });

        it('should have aria-invalid on rating field when there is an error', async () => {
            const { container } = render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                const ratingGroup = container.querySelector('[role="radiogroup"]');
                expect(ratingGroup).toHaveAttribute('aria-invalid', 'true');
            });
        });

        it('should have aria-required on title input', () => {
            render(<ReviewForm {...defaultProps} />);
            const titleInput = screen.getByLabelText('Título');
            expect(titleInput).toHaveAttribute('aria-required', 'true');
        });

        it('should have aria-invalid on title input when there is an error', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                const titleInput = screen.getByLabelText('Título');
                expect(titleInput).toHaveAttribute('aria-invalid', 'true');
            });
        });

        it('should have aria-describedby on title input when there is an error', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                const titleInput = screen.getByLabelText('Título');
                expect(titleInput).toHaveAttribute('aria-describedby', 'title-error');
            });
        });

        it('should have aria-required on content textarea', () => {
            render(<ReviewForm {...defaultProps} />);
            const contentTextarea = screen.getByLabelText('Comentario');
            expect(contentTextarea).toHaveAttribute('aria-required', 'true');
        });

        it('should have aria-invalid on content textarea when there is an error', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                const contentTextarea = screen.getByLabelText('Comentario');
                expect(contentTextarea).toHaveAttribute('aria-invalid', 'true');
            });
        });

        it('should have aria-describedby on content textarea when there is an error', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                const contentTextarea = screen.getByLabelText('Comentario');
                expect(contentTextarea).toHaveAttribute('aria-describedby', 'content-error');
            });
        });

        it('should have role="alert" on error messages', async () => {
            render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                const errors = screen.getAllByRole('alert');
                expect(errors.length).toBeGreaterThan(0);
            });
        });

        it('should have aria-live="polite" on error messages', async () => {
            const { container } = render(<ReviewForm {...defaultProps} />);

            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            fireEvent.click(submitButton);

            await waitFor(() => {
                const errorMessages = Array.from(container.querySelectorAll('[role="alert"]'));
                for (const error of errorMessages) {
                    expect(error).toHaveAttribute('aria-live', 'polite');
                }
            });
        });

        it('should have aria-hidden on star SVG icons', () => {
            const { container } = render(<ReviewForm {...defaultProps} />);
            const starSvgs = Array.from(
                container.querySelectorAll('button[aria-label^="Calificar"] svg')
            );

            for (const svg of starSvgs) {
                expect(svg).toHaveAttribute('aria-hidden', 'true');
            }
        });

        it('should have aria-label on each star button', () => {
            render(<ReviewForm {...defaultProps} />);

            expect(screen.getByLabelText('Calificar 1 estrella(s)')).toBeInTheDocument();
            expect(screen.getByLabelText('Calificar 2 estrella(s)')).toBeInTheDocument();
            expect(screen.getByLabelText('Calificar 3 estrella(s)')).toBeInTheDocument();
            expect(screen.getByLabelText('Calificar 4 estrella(s)')).toBeInTheDocument();
            expect(screen.getByLabelText('Calificar 5 estrella(s)')).toBeInTheDocument();
        });

        it('should have focus-visible styles on star buttons', () => {
            render(<ReviewForm {...defaultProps} />);
            const firstStar = screen.getByLabelText('Calificar 1 estrella(s)');
            expect(firstStar.className).toContain('focus-visible:outline');
        });

        it('should have focus-visible styles on submit button', () => {
            render(<ReviewForm {...defaultProps} />);
            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            expect(submitButton.className).toContain('focus-visible:outline');
        });

        it('should have focus-visible styles on cancel button', () => {
            render(
                <ReviewForm
                    {...defaultProps}
                    onCancel={vi.fn()}
                />
            );
            const cancelButton = screen.getByRole('button', { name: 'Cancelar' });
            expect(cancelButton.className).toContain('focus-visible:outline');
        });
    });

    describe('Styling', () => {
        it('should apply custom className to form', () => {
            const { container } = render(
                <ReviewForm
                    {...defaultProps}
                    className="custom-form-class"
                />
            );
            const form = container.querySelector('form');
            expect(form).toHaveClass('custom-form-class');
        });

        it('should have transition styles on star buttons', () => {
            render(<ReviewForm {...defaultProps} />);
            const firstStar = screen.getByLabelText('Calificar 1 estrella(s)');
            expect(firstStar.className).toContain('transition-transform');
        });

        it('should have hover scale effect on star buttons', () => {
            render(<ReviewForm {...defaultProps} />);
            const firstStar = screen.getByLabelText('Calificar 1 estrella(s)');
            expect(firstStar.className).toContain('hover:scale-110');
        });

        it('should have transition styles on action buttons', () => {
            render(
                <ReviewForm
                    {...defaultProps}
                    onCancel={vi.fn()}
                />
            );
            const submitButton = screen.getByRole('button', { name: 'Enviar reseña' });
            const cancelButton = screen.getByRole('button', { name: 'Cancelar' });

            expect(submitButton.className).toContain('transition-colors');
            expect(cancelButton.className).toContain('transition-colors');
        });

        it('should have proper spacing between form sections', () => {
            const { container } = render(<ReviewForm {...defaultProps} />);
            const form = container.querySelector('form');
            expect(form?.className).toContain('space-y-6');
        });

        it('should have proper gap between action buttons', () => {
            const { container } = render(
                <ReviewForm
                    {...defaultProps}
                    onCancel={vi.fn()}
                />
            );
            const buttonContainer = container.querySelector('form > div:last-child');
            expect(buttonContainer?.className).toContain('gap-4');
        });
    });

    describe('Entity Props', () => {
        it('should accept entityType "accommodation"', () => {
            const { container } = render(
                <ReviewForm
                    entityId="123"
                    entityType="accommodation"
                />
            );
            const form = container.querySelector('form');
            expect(form).toHaveAttribute('data-entity-type', 'accommodation');
        });

        it('should accept entityType "destination"', () => {
            const { container } = render(
                <ReviewForm
                    entityId="456"
                    entityType="destination"
                />
            );
            const form = container.querySelector('form');
            expect(form).toHaveAttribute('data-entity-type', 'destination');
        });

        it('should accept entityType "event"', () => {
            const { container } = render(
                <ReviewForm
                    entityId="789"
                    entityType="event"
                />
            );
            const form = container.querySelector('form');
            expect(form).toHaveAttribute('data-entity-type', 'event');
        });
    });
});
