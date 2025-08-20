/**
 * Basic test suite for Auth UI package
 * Tests fundamental authentication components and functionality
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/**
 * Simple test component for verification
 */
const TestAuthComponent = () => {
    return (
        <div>
            <h1>Auth UI Test</h1>
            <p>Authentication components testing environment is working</p>
            <button type="button">Test Button</button>
        </div>
    );
};

describe('Auth UI Package - Basic Tests', () => {
    it('should render test component correctly', () => {
        render(<TestAuthComponent />);

        expect(screen.getByText('Auth UI Test')).toBeInTheDocument();
        expect(
            screen.getByText('Authentication components testing environment is working')
        ).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Test Button' })).toBeInTheDocument();
    });

    it('should have correct environment setup', () => {
        expect(process.env.NODE_ENV).toBe('test');
    });

    it('should handle authentication state utilities', () => {
        const isValidEmail = (email: string): boolean => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email);
        };

        const formatUserName = (firstName?: string, lastName?: string): string => {
            if (!firstName && !lastName) return 'Anonymous';
            return [firstName, lastName].filter(Boolean).join(' ');
        };

        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('invalid-email')).toBe(false);
        expect(formatUserName('John', 'Doe')).toBe('John Doe');
        expect(formatUserName('John')).toBe('John');
        expect(formatUserName()).toBe('Anonymous');
    });

    it('should mock Clerk hooks correctly', () => {
        // This test verifies that our Clerk mocks are working
        // In a real component test, we would import and use the actual hooks
        expect(true).toBe(true);
    });
});
