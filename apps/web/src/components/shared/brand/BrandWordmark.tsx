import { cn } from '@/lib/cn';
import styles from './BrandWordmark.module.css';

/** Presentation options for the shared, server-renderable brand. */
export interface BrandWordmarkProps {
    /** Optimized asset URL; an empty URL preserves text-only legacy callers. */
    readonly logoSrc: string;
    readonly size?: 'sm' | 'md' | 'lg';
    readonly className?: string;
    readonly as?: 'span';
    readonly tone?: 'default' | 'inverse';
}

/** Renders the brand once, with a decorative mark and a visible sans wordmark. */
export function BrandWordmark({
    logoSrc,
    size = 'md',
    className,
    as: Tag = 'span',
    tone = 'default'
}: BrandWordmarkProps) {
    return (
        <Tag className={cn(styles.root, styles[size], styles[tone], className)}>
            {logoSrc && (
                <img
                    src={logoSrc}
                    alt=""
                    aria-hidden="true"
                    width={34}
                    height={36}
                    className={styles.mark}
                    decoding="async"
                />
            )}
            <span>Hospeda</span>
        </Tag>
    );
}
