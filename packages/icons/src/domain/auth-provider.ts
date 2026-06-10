/**
 * @file domain/auth-provider.ts
 * @description Single source of truth for the auth-provider → visual mapping
 * ({ icon, colorToken }). Shared by `apps/web` and `apps/admin` so a given
 * auth provider renders with the SAME icon and the SAME color in both surfaces.
 *
 * Keys are lowercase provider slugs (matching the lowercased `AuthProviderEnum`
 * values). Unknown providers fall back to `LockIcon` + the `auth-provider-local`
 * token.
 */

import type { ComponentType } from 'react';
import { FacebookIcon } from '../icons/social/FacebookIcon';
import { GithubIcon } from '../icons/social/GithubIcon';
import { GoogleIcon } from '../icons/social/GoogleIcon';
import { LockIcon } from '../icons/system/LockIcon';
import { ShieldIcon } from '../icons/system/ShieldIcon';
import type { IconProps } from '../types';

export interface AuthProviderColorScheme {
    readonly bg: string;
    readonly text: string;
    readonly border: string;
}

export interface AuthProviderVisual {
    readonly icon: ComponentType<IconProps>;
    /** Per-provider design-token name (e.g. `'auth-provider-google'`). */
    readonly colorToken: string;
}

/**
 * Canonical auth-provider → visual map. Keys are lowercase provider slugs.
 */
export const AUTH_PROVIDER_VISUALS: Readonly<Record<string, AuthProviderVisual>> = {
    local: { icon: LockIcon, colorToken: 'auth-provider-local' },
    google: { icon: GoogleIcon, colorToken: 'auth-provider-google' },
    facebook: { icon: FacebookIcon, colorToken: 'auth-provider-facebook' },
    github: { icon: GithubIcon, colorToken: 'auth-provider-github' },
    better_auth: { icon: ShieldIcon, colorToken: 'auth-provider-better-auth' }
};

export const AUTH_PROVIDER_FALLBACK_VISUAL: AuthProviderVisual = {
    icon: LockIcon,
    colorToken: 'auth-provider-local'
};

interface AuthProviderParams {
    /** Provider slug (case-insensitive, e.g. `'GOOGLE'` or `'better_auth'`). */
    readonly provider: string;
}

export function getAuthProviderVisual({ provider }: AuthProviderParams): AuthProviderVisual {
    return AUTH_PROVIDER_VISUALS[provider.toLowerCase()] ?? AUTH_PROVIDER_FALLBACK_VISUAL;
}

export function getAuthProviderIcon({ provider }: AuthProviderParams): ComponentType<IconProps> {
    return getAuthProviderVisual({ provider }).icon;
}

export type AuthProviderColorVariant = 'subtle' | 'contrast';

export function getAuthProviderColorScheme({
    provider,
    variant = 'subtle'
}: AuthProviderParams & {
    readonly variant?: AuthProviderColorVariant;
}): AuthProviderColorScheme {
    const cssToken = getAuthProviderVisual({ provider }).colorToken;

    if (variant === 'contrast') {
        return {
            bg: `oklch(from var(--${cssToken}) 0.95 calc(c * 0.55) h)`,
            text: `oklch(from var(--${cssToken}) 0.4 c h)`,
            border: `oklch(from var(--${cssToken}) 0.88 calc(c * 0.55) h)`
        };
    }

    // SPEC-176 T-006: precomputed a15/a30 tokens provide Chrome-109-safe sRGB
    // fallbacks for badge bg and border without regressing modern browsers.
    return {
        bg: `var(--${cssToken}-a15)`,
        text: `var(--${cssToken})`,
        border: `var(--${cssToken}-a30)`
    };
}
