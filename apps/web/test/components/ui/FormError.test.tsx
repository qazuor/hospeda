/**
 * Tests for FormError component (GAP-009, GAP-039).
 *
 * Verifies ARIA compliance, conditional rendering, and id generation.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormError } from '../../../src/components/ui/FormError';

describe('FormError', () => {
    describe('conditional rendering', () => {
        it('should render nothing when error is undefined', () => {
            // Arrange & Act
            const { container } = render(<FormError fieldName="email" />);

            // Assert
            expect(container.firstChild).toBeNull();
        });

        it('should render nothing when error is an empty string', () => {
            // Arrange & Act
            const { container } = render(
                <FormError
                    fieldName="email"
                    error=""
                />
            );

            // Assert
            expect(container.firstChild).toBeNull();
        });

        it('should render the error message when error is a non-empty string', () => {
            // Arrange & Act
            render(
                <FormError
                    fieldName="email"
                    error="Email is required"
                />
            );

            // Assert
            expect(screen.getByText('Email is required')).toBeDefined();
        });
    });

    describe('ARIA compliance', () => {
        it('should have role="alert"', () => {
            // Arrange & Act
            render(
                <FormError
                    fieldName="name"
                    error="Name is required"
                />
            );

            // Assert
            const el = screen.getByRole('alert');
            expect(el).toBeDefined();
        });

        it('should have aria-live="polite"', () => {
            // Arrange & Act
            render(
                <FormError
                    fieldName="name"
                    error="Name is required"
                />
            );

            // Assert
            const el = screen.getByRole('alert');
            expect(el.getAttribute('aria-live')).toBe('polite');
        });

        it('should generate id as {fieldName}-error', () => {
            // Arrange & Act
            render(
                <FormError
                    fieldName="email"
                    error="Invalid email"
                />
            );

            // Assert
            const el = document.getElementById('email-error');
            expect(el).not.toBeNull();
            expect(el?.textContent).toBe('Invalid email');
        });

        it('should generate correct id for compound field names', () => {
            // Arrange & Act
            render(
                <FormError
                    fieldName="confirm-password"
                    error="Passwords do not match"
                />
            );

            // Assert
            const el = document.getElementById('confirm-password-error');
            expect(el).not.toBeNull();
        });
    });

    describe('className prop', () => {
        it('should apply custom className alongside default classes', () => {
            // Arrange & Act
            render(
                <FormError
                    fieldName="email"
                    error="Error"
                    className="custom-class"
                />
            );

            // Assert
            const el = screen.getByRole('alert');
            expect(el.className).toContain('custom-class');
        });

        it('should not include "undefined" in className when className is not provided', () => {
            // Arrange & Act
            render(
                <FormError
                    fieldName="email"
                    error="Error"
                />
            );

            // Assert
            const el = screen.getByRole('alert');
            expect(el.className).not.toContain('undefined');
        });
    });

    describe('error message content', () => {
        it('should display the exact error message text', () => {
            // Arrange
            const errorMessage = 'Password must be at least 8 characters';

            // Act
            render(
                <FormError
                    fieldName="password"
                    error={errorMessage}
                />
            );

            // Assert
            expect(screen.getByText(errorMessage)).toBeDefined();
        });
    });
});
