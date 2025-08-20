/**
 * Test setup file for Vitest in Web app (Astro)
 * Configures test environment and global mocks for Astro components
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, vi } from 'vitest';

// Global test setup
beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';

    // Mock environment variables for testing
    process.env.CLERK_PUBLISHABLE_KEY = 'test_clerk_publishable';
    process.env.CLERK_SECRET_KEY = 'test_clerk_secret';
    process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
});

// Cleanup after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

// Mock Clerk authentication for Astro
vi.mock('@clerk/astro', () => ({
    clerkMiddleware: () => (_req: any, next: any) => next(),
    getAuth: () => ({
        userId: 'test_user_id',
        sessionId: 'test_session_id'
    })
}));

// Mock Clerk React components
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

// Mock Astro globals
Object.defineProperty(globalThis, 'Astro', {
    value: {
        url: new URL('http://localhost:4321/'),
        request: new Request('http://localhost:4321/'),
        params: {},
        props: {},
        locals: {}
    },
    writable: true
});
