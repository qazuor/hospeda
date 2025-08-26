/**
 * Basic test suite for Web app (Astro)
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
            <h1>Web App Test</h1>
            <p>Astro testing environment is working</p>
        </div>
    );
};

describe('Web App - Basic Tests', () => {
    it('should render test component correctly', () => {
        render(<TestComponent />);

        expect(screen.getByText('Web App Test')).toBeInTheDocument();
        expect(screen.getByText('Astro testing environment is working')).toBeInTheDocument();
    });

    it('should have correct environment setup', () => {
        expect(process.env.NODE_ENV).toBe('test');
        expect(process.env.PUBLIC_CLERK_PUBLISHABLE_KEY).toBe('test_clerk_publishable');
        expect(process.env.HOSPEDA_DATABASE_URL).toBe(
            'postgresql://test:test@localhost:5432/test_db'
        );
    });

    it('should have Astro global available', () => {
        // Type assertion for globalThis.Astro since it's added by Astro runtime
        const astroGlobal = (globalThis as any).Astro;
        expect(astroGlobal).toBeDefined();
        expect(astroGlobal.url).toBeInstanceOf(URL);
        expect(astroGlobal.request).toBeInstanceOf(Request);
    });

    it('should handle utility functions', () => {
        const formatDate = (date: Date): string => {
            const isoString = date.toISOString();
            const datePart = isoString.split('T')[0];
            return datePart || isoString; // Fallback to full ISO string if split fails
        };

        const testDate = new Date('2024-01-15');
        expect(formatDate(testDate)).toBe('2024-01-15');
    });
});
