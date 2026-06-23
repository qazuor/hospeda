/**
 * @file SocialPostPlatformIcons.tsx
 * @description Icon row showing the platforms a social post targets (SPEC-254 T-039).
 *
 * Each icon has an aria-label for accessibility. Icons come from @repo/icons only.
 */

import { FacebookIcon, InstagramIcon, XIcon } from '@repo/icons';
import { SocialPlatformEnum } from '@repo/schemas';

/** Props for {@link SocialPostPlatformIcons}. */
export interface SocialPostPlatformIconsProps {
    /** List of platform slugs the post targets. */
    readonly platforms: readonly string[];
}

/** Icon component and label for each platform. */
const PLATFORM_ICON_MAP: Record<
    string,
    { Icon: React.ComponentType<{ className?: string }>; label: string }
> = {
    [SocialPlatformEnum.INSTAGRAM]: { Icon: InstagramIcon, label: 'Instagram' },
    [SocialPlatformEnum.FACEBOOK]: { Icon: FacebookIcon, label: 'Facebook' },
    [SocialPlatformEnum.X]: { Icon: XIcon, label: 'X (Twitter)' }
};

/**
 * Renders a horizontal row of platform icons.
 * Unknown platform slugs are silently ignored.
 *
 * @param props - {@link SocialPostPlatformIconsProps}
 */
export function SocialPostPlatformIcons({ platforms }: SocialPostPlatformIconsProps) {
    if (platforms.length === 0) {
        return <span className="text-muted-foreground text-xs">—</span>;
    }

    return (
        <div className="flex items-center gap-1.5">
            {platforms.map((platform) => {
                const entry = PLATFORM_ICON_MAP[platform];
                if (!entry) return null;
                const { Icon, label } = entry;
                return (
                    <span
                        key={platform}
                        aria-label={label}
                        title={label}
                        className="text-muted-foreground"
                        data-testid={`platform-icon-${platform}`}
                    >
                        <Icon className="h-4 w-4" />
                    </span>
                );
            })}
        </div>
    );
}
