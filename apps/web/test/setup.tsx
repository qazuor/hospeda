import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

/**
 * Cleanup after each test
 *
 * This ensures that components are unmounted and DOM is cleaned up
 * between tests to prevent side effects and memory leaks.
 */
afterEach(() => {
    cleanup();
});
