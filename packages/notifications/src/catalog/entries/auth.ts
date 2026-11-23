/**
 * Catalog entries of the auth emails (`apps/api/src/lib/auth.ts`).
 *
 * @module catalog/entries/auth
 */

import {
    RESET_PASSWORD_EMAIL_SUBJECT,
    ResetPasswordTemplate,
    VERIFY_EMAIL_SUBJECT,
    VerifyEmailTemplate
} from '@repo/email';
import { defineEmailCatalogEntry } from '../define-entry.js';
import type { EmailCatalogEntry } from '../types.js';

/** Sample input of the auth emails: the user's name and the link's token. */
interface AuthEmailSample {
    readonly name: string | null;
    readonly token: string;
}

const AUTH_SCENARIOS = [
    {
        id: 'with-name',
        label: 'Con nombre',
        input: { name: 'Ana Ejemplo', token: 'token-de-ejemplo-123' }
    },
    {
        id: 'without-name',
        label: 'Sin nombre (saludo genérico)',
        input: { name: null, token: 'token-de-ejemplo-123' }
    }
] as const satisfies readonly [
    { id: string; label: string; input: AuthEmailSample },
    ...{ id: string; label: string; input: AuthEmailSample }[]
];

/** The two auth emails. */
export const AUTH_ENTRIES: readonly EmailCatalogEntry[] = [
    defineEmailCatalogEntry<AuthEmailSample>({
        sendPath: 'auth',
        id: 'reset-password',
        name: 'Restablecer contraseña',
        domain: 'auth',
        audience: 'user',
        scenarios: AUTH_SCENARIOS,
        render: ({ scenario, deps }) => ({
            subject: RESET_PASSWORD_EMAIL_SUBJECT,
            react: ResetPasswordTemplate({
                name: scenario.name,
                resetUrl: `${deps.siteUrl.replace(/\/$/, '')}/es/auth/reset-password?token=${encodeURIComponent(scenario.token)}`
            }),
            warnings: []
        })
    }),
    defineEmailCatalogEntry<AuthEmailSample>({
        sendPath: 'auth',
        id: 'verify-email',
        name: 'Verificación de cuenta',
        domain: 'auth',
        audience: 'user',
        scenarios: AUTH_SCENARIOS,
        render: ({ scenario, deps }) => ({
            subject: VERIFY_EMAIL_SUBJECT,
            react: VerifyEmailTemplate({
                name: scenario.name,
                verificationUrl: `${deps.siteUrl.replace(/\/$/, '')}/es/auth/verify-email?token=${encodeURIComponent(scenario.token)}`
            }),
            warnings: []
        })
    })
];
