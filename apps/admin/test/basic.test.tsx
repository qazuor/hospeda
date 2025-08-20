/**
 * Basic test suite for Admin app
 * Tests fundamental functionality and setup
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/**
 * Simple test component for verification
 */
const TestComponent = () => {
    return (
        <div>
            <h1>Admin App Test</h1>
            <p>Testing environment is working</p>
        </div>
    );
};

describe('Admin App - Basic Tests', () => {
    it('should render test component correctly', () => {
        render(<TestComponent />);

        expect(screen.getByText('Admin App Test')).toBeInTheDocument();
        expect(screen.getByText('Testing environment is working')).toBeInTheDocument();
    });

    it('should have correct environment setup', () => {
        expect(process.env.NODE_ENV).toBe('test');
        expect(process.env.VITE_CLERK_PUBLISHABLE_KEY).toBe('test_clerk_publishable');
    });

    it('should handle basic math operations', () => {
        const add = (a: number, b: number): number => a + b;
        const multiply = (a: number, b: number): number => a * b;

        expect(add(2, 3)).toBe(5);
        expect(multiply(4, 5)).toBe(20);
    });
});
