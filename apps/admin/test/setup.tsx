/**
 * Test setup file for Vitest in Admin app
 * Configures test environment and global mocks for React components
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './mocks/server';

// Start MSW server before all tests
beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';

    // Mock environment variables for testing
    process.env.VITE_BETTER_AUTH_URL = 'http://localhost:3001';

    // Start MSW server to intercept HTTP requests
    server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers after each test (important for test isolation)
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    server.resetHandlers();
});

// Close MSW server after all tests
afterAll(() => {
    server.close();
});

// Mock Better Auth React client
vi.mock('better-auth/react', () => {
    const mockSession = {
        user: {
            id: 'test_user_id',
            name: 'Test User',
            email: 'test@example.com',
            emailVerified: true,
            image: null,
            role: 'USER',
            createdAt: new Date(),
            updatedAt: new Date()
        },
        session: {
            id: 'test_session_id',
            userId: 'test_user_id',
            token: 'test-session-token',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
    };

    return {
        createAuthClient: vi.fn(() => ({
            useSession: vi.fn(() => ({
                data: mockSession,
                isPending: false,
                error: null
            })),
            signIn: {
                email: vi.fn().mockResolvedValue({ data: mockSession, error: null }),
                social: vi.fn().mockResolvedValue({})
            },
            signUp: {
                email: vi.fn().mockResolvedValue({ data: mockSession, error: null })
            },
            signOut: vi.fn().mockResolvedValue({}),
            getSession: vi.fn().mockResolvedValue(mockSession)
        }))
    };
});

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
