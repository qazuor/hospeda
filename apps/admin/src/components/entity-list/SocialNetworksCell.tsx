import {
    FacebookIcon,
    InstagramIcon,
    LinkedInIcon,
    TiktokIcon,
    XIcon,
    YoutubeIcon
} from '@repo/icons';
import type { ComponentType } from 'react';

interface SocialNetworks {
    readonly facebook?: string | null;
    readonly instagram?: string | null;
    readonly twitter?: string | null;
    readonly linkedIn?: string | null;
    readonly tiktok?: string | null;
    readonly youtube?: string | null;
}

interface SocialNetworksCellProps {
    /** Social networks object — each field is the public URL of the profile. */
    readonly social: SocialNetworks | null | undefined;
}

interface NetworkRow {
    readonly key: keyof SocialNetworks;
    readonly url: string | null | undefined;
    readonly Icon: ComponentType<{ size: number; 'aria-label': string }>;
    readonly label: string;
}

/**
 * Defense-in-depth scheme allowlist. The stored URLs are already validated by
 * `SocialNetworkSchema` (Zod regex per network), but rendering a raw value as
 * an `href` is the kind of code that survives unrelated schema changes — so
 * we re-check here to make sure no `javascript:` / `data:` / `vbscript:` URL
 * ever makes it into the DOM.
 */
function isSafeUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
        return false;
    }
}

/**
 * Renders each present social-network URL as a small clickable brand icon.
 * Empty / missing networks are omitted. Icons open the URL in a new tab.
 */
export const SocialNetworksCell = ({ social }: SocialNetworksCellProps) => {
    if (!social) {
        return <span className="text-muted-foreground">—</span>;
    }

    const rows: ReadonlyArray<NetworkRow> = [
        { key: 'facebook', url: social.facebook, Icon: FacebookIcon, label: 'Facebook' },
        { key: 'instagram', url: social.instagram, Icon: InstagramIcon, label: 'Instagram' },
        { key: 'twitter', url: social.twitter, Icon: XIcon, label: 'X (Twitter)' },
        { key: 'linkedIn', url: social.linkedIn, Icon: LinkedInIcon, label: 'LinkedIn' },
        { key: 'tiktok', url: social.tiktok, Icon: TiktokIcon, label: 'TikTok' },
        { key: 'youtube', url: social.youtube, Icon: YoutubeIcon, label: 'YouTube' }
    ];

    const present = rows.filter(
        (r): r is NetworkRow & { url: string } => Boolean(r.url) && isSafeUrl(r.url as string)
    );

    if (present.length === 0) {
        return <span className="text-muted-foreground">—</span>;
    }

    return (
        <span className="inline-flex items-center gap-2">
            {present.map(({ key, url, Icon, label }) => (
                <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Abrir ${label}`}
                    title={label}
                >
                    <Icon
                        size={16}
                        aria-label={label}
                    />
                </a>
            ))}
        </span>
    );
};
