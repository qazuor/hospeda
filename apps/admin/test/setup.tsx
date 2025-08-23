/**
 * Test setup file for Vitest in Admin app
 * Configures test environment and global mocks for React components
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Global test setup
beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';

    // Mock environment variables for testing
    process.env.PUBLIC_CLERK_PUBLISHABLE_KEY = 'test_clerk_publishable';
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
        getToken: vi.fn().mockResolvedValue('test_token')
    }),
    useUser: () => ({
        user: {
            id: 'test_user_id',
            firstName: 'Test',
            lastName: 'User',
            emailAddresses: [{ emailAddress: 'test@example.com' }]
        }
    }),
    ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
    SignInButton: ({ children }: { children: React.ReactNode }) => children,
    SignOutButton: ({ children }: { children: React.ReactNode }) => children,
    UserButton: () => null
}));

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({
        navigate: vi.fn(),
        history: {
            push: vi.fn(),
            replace: vi.fn()
        }
    }),
    useNavigate: () => vi.fn(),
    Link: ({ children, to, ...props }: any) => {
        return (
            <a
                href={to}
                {...props}
            >
                {children}
            </a>
        );
    },
    Outlet: () => null,
    createRouter: vi.fn(),
    createRoute: vi.fn(),
    createRootRoute: vi.fn()
}));
