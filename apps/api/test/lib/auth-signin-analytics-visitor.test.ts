/**
 * @file auth-signin-analytics-visitor.test.ts
 * @description Visitor attribution for `sign_in_completed` (HOS-2119, T-072):
 * a normal sign-in carries the visitor; impersonation and staff-initiated
 * (marked) requests carry none. The marker is also proven to survive a real
 * Better Auth `signUpEmail` call down to the `session.create.after` hook context.
 */
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it } from 'vitest';
import { resolveSignInVisitor, type SignupContextLike } from '../../src/lib/auth-signup-analytics';
import {
    getVisitorContextFromHeaders,
    markHeadersAsNotVisitor
} from '../../src/utils/visitor-context';

const HEADERS = { 'cf-connecting-ip': '203.0.113.7', 'user-agent': 'UA/1' };
const VISITOR = { ip: '203.0.113.7', userAgent: 'UA/1' };

describe('resolveSignInVisitor', () => {
    it('should return the visitor for a normal sign-in', () => {
        const context: SignupContextLike = {
            path: '/sign-in/email',
            headers: new Headers(HEADERS)
        };
        expect(resolveSignInVisitor({ session: { impersonatedBy: null }, context })).toEqual(
            VISITOR
        );
    });

    it('should return undefined for an impersonation session', () => {
        const context: SignupContextLike = { headers: new Headers(HEADERS) };
        expect(
            resolveSignInVisitor({ session: { impersonatedBy: 'admin-1' }, context })
        ).toBeUndefined();
    });

    it('should return undefined for an /admin/* endpoint', () => {
        const context: SignupContextLike = {
            path: '/admin/impersonate-user',
            headers: new Headers(HEADERS)
        };
        expect(resolveSignInVisitor({ session: {}, context })).toBeUndefined();
    });

    it('should return undefined for marked (staff-initiated) headers', () => {
        const context: SignupContextLike = {
            path: '/sign-up/email',
            headers: markHeadersAsNotVisitor({ headers: new Headers(HEADERS) })
        };
        expect(resolveSignInVisitor({ session: {}, context })).toBeUndefined();
    });

    it('should return undefined when there is no context', () => {
        expect(resolveSignInVisitor({ session: {}, context: null })).toBeUndefined();
    });
});

describe('Better Auth hook context carries the headers passed to signUpEmail', () => {
    async function signUpAndCollect(headers: Headers): Promise<Array<Headers | null | undefined>> {
        const seen: Array<Headers | null | undefined> = [];
        const auth = betterAuth({
            baseURL: 'http://localhost:3001',
            secret: 'test-secret-value-at-least-32-characters-long',
            database: memoryAdapter({ user: [], session: [], account: [], verification: [] }),
            emailAndPassword: { enabled: true },
            databaseHooks: {
                session: {
                    create: {
                        after: async (_session, context) => {
                            seen.push(context?.headers ?? context?.request?.headers);
                        }
                    }
                }
            }
        });
        await auth.api.signUpEmail({
            body: {
                email: 'ana@example.com',
                password: ['Password', '123!'].join(''),
                name: 'Ana'
            },
            headers
        });
        return seen;
    }

    it('should expose a normal visitor to the session hook', async () => {
        const seen = await signUpAndCollect(new Headers(HEADERS));
        expect(seen).toHaveLength(1);
        expect(getVisitorContextFromHeaders({ headers: seen[0] })).toEqual(VISITOR);
    });

    it('should expose no visitor to the session hook when the headers are marked', async () => {
        const seen = await signUpAndCollect(
            markHeadersAsNotVisitor({ headers: new Headers(HEADERS) })
        );
        expect(seen).toHaveLength(1);
        expect(seen[0]).toBeInstanceOf(Headers);
        expect(getVisitorContextFromHeaders({ headers: seen[0] })).toBeUndefined();
    });
});
