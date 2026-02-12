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
    process.env.PUBLIC_BETTER_AUTH_URL = 'http://localhost:3001';
    process.env.HOSPEDA_DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
});

// Cleanup after each test
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
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
