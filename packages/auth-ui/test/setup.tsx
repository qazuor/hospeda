/**
 * Test setup file for Vitest in Auth UI package
 * Configures test environment and global mocks
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Global test setup
beforeAll(() => {
    process.env.NODE_ENV = 'test';
});

// Cleanup after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
    User: () => <div data-testid="user-icon">User Icon</div>,
    LogIn: () => <div data-testid="login-icon">Login Icon</div>,
    LogOut: () => <div data-testid="logout-icon">Logout Icon</div>,
    UserPlus: () => <div data-testid="userplus-icon">UserPlus Icon</div>,
    Settings: () => <div data-testid="settings-icon">Settings Icon</div>
}));
