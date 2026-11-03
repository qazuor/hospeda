/** Provider ids whose account credentials may be retained after email verification. */
export const SOCIAL_SESSION_PROVIDERS = ['google', 'facebook'] as const;

/** Resolves the credential responsible for a newly created Better Auth session. */
export function resolveSessionAuthMethod(input: {
    readonly path: string | undefined;
    readonly providerId: string | undefined;
}): string | null {
    const { path, providerId } = input;
    if (path === '/sign-in/email') return 'credential';
    if (path === '/verify-email') return 'email-verification';
    if (
        path === '/callback/:id' ||
        path === '/oauth2/callback/:providerId' ||
        path?.startsWith('/callback/')
    ) {
        const pathProvider = path.split('/').at(-1);
        const candidate = providerId ?? pathProvider;
        return SOCIAL_SESSION_PROVIDERS.includes(
            candidate as (typeof SOCIAL_SESSION_PROVIDERS)[number]
        )
            ? (candidate ?? null)
            : null;
    }
    return null;
}
