import { Heart, type LucideProps } from 'lucide-react';

export type HeartIconVariant = 'outline' | 'solid';

export type HeartIconProps = {
    readonly className?: string;
    readonly size?: number;
    readonly color?: string;
    readonly title?: string;
    readonly variant?: HeartIconVariant;
} & Omit<LucideProps, 'width' | 'height' | 'color' | 'className'>;

/**
 * HeartIcon
 * Wrapper icon component for a Heart shape. Internally uses a third-party icon library
 * but exposes a stable API so we can swap libraries without affecting callsites.
 */
export const HeartIcon = ({
    className,
    size = 24,
    color,
    title,
    variant = 'outline',
    ...rest
}: HeartIconProps): JSX.Element => {
    const isSolid = variant === 'solid';
    // biome-ignore lint/suspicious/noExplicitAny: lucide-react type compatibility issue
    const HeartComponent = Heart as any;
    return (
        <HeartComponent
            aria-hidden={title ? undefined : true}
            aria-label={title}
            width={size}
            height={size}
            color={color}
            className={`${className ?? ''} ${isSolid ? 'fill-current' : ''}`}
            strokeWidth={isSolid ? 0 : undefined}
            {...rest}
        />
    );
};

export type { HeartIcon as DefaultHeartIcon };
