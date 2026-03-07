/**
 * @file Vitest setup for the web app.
 * Provides DOM matchers (toBeInTheDocument, toHaveClass, etc.) and
 * automatic cleanup between tests.
 */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
    cleanup();
});
