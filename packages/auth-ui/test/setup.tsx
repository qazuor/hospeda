/**
 * Test setup file for Vitest in Auth UI package
 * Configures test environment and global mocks for authentication components
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Global test setup
beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
});

// Cleanup after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

// Mock Clerk authentication
vi.mock('@clerk/clerk-react', () => ({
    useAuth: () => ({
        isSignedIn: true,
        userId: 'test_user_id',
        sessionId: 'test_session_id',
        getToken: vi.fn().mockResolvedValue('test_token'),
        signOut: vi.fn()
    }),
    useUser: () => ({
        user: {
            id: 'test_user_id',
            firstName: 'Test',
            lastName: 'User',
            emailAddresses: [{ emailAddress: 'test@example.com' }],
            imageUrl: 'https://example.com/avatar.jpg'
        }
    }),
    useClerk: () => ({
        signOut: vi.fn(),
        openSignIn: vi.fn(),
        openSignUp: vi.fn()
    }),
    ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
    SignInButton: ({ children }: { children: React.ReactNode }) => children,
    SignOutButton: ({ children }: { children: React.ReactNode }) => children,
    SignUpButton: ({ children }: { children: React.ReactNode }) => children,
    UserButton: () => null,
    SignIn: () => null,
    SignUp: () => null
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
    User: () => <div data-testid="user-icon">User Icon</div>,
    LogIn: () => <div data-testid="login-icon">Login Icon</div>,
    LogOut: () => <div data-testid="logout-icon">Logout Icon</div>,
    UserPlus: () => <div data-testid="userplus-icon">UserPlus Icon</div>,
    Settings: () => <div data-testid="settings-icon">Settings Icon</div>
}));
