import { cn } from '@/lib/utils';
import type React from 'react';

/**
 * Props for Progress component
 */
export interface ProgressProps {
    /** Progress value (0-100) */
    value: number;
    /** Additional CSS classes */
    className?: string;
    /** Size variant */
    size?: 'sm' | 'md' | 'lg';
    /** Color variant */
    variant?: 'default' | 'success' | 'warning' | 'error';
}

/**
 * Simple progress bar component
 *
 * @example
 * ```tsx
 * <Progress value={75} className="w-full" />
 * <Progress value={100} variant="success" size="lg" />
 * ```
 */
export const Progress: React.FC<ProgressProps> = ({
    value,
    className,
    size = 'md',
    variant = 'default'
}) => {
    // Clamp value between 0 and 100
    const clampedValue = Math.min(100, Math.max(0, value));

    const sizeClasses = {
        sm: 'h-1',
        md: 'h-2',
        lg: 'h-3'
    };

    const variantClasses = {
        default: 'bg-blue-500',
        success: 'bg-green-500',
        warning: 'bg-amber-500',
        error: 'bg-red-500'
    };

    return (
        <div
            className={cn(
                'w-full overflow-hidden rounded-full bg-gray-200',
                sizeClasses[size],
                className
            )}
            role="progressbar"
            tabIndex={0}
            aria-valuenow={clampedValue}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className={cn(
                    'h-full rounded-full transition-all duration-300 ease-in-out',
                    variantClasses[variant]
                )}
                style={{ width: `${clampedValue}%` }}
            />
        </div>
    );
};
