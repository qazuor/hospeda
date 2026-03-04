/**
 * Single counter animation with vertical layout.
 * Animates a number from 0 to targetValue when entering the viewport.
 * Used by StatisticsSection on the owners page.
 */
import { formatNumber, toBcp47Locale } from '@repo/i18n';
import { useCountUp, useViewportTrigger } from '../../hooks/useCountUp';

interface CounterAnimationProps {
    /** Target number to animate to */
    readonly targetValue: number;
    /** Text displayed after the number (e.g., '+') */
    readonly suffix?: string;
    /** Text displayed before the number */
    readonly prefix?: string;
    /** Descriptive label shown below the number */
    readonly label: string;
    /** Locale for number formatting */
    readonly locale?: string;
}

/**
 * Vertical counter with prefix/suffix, locale-formatted number,
 * and screen-reader-friendly aria-live announcement.
 */
export const CounterAnimation = ({
    targetValue,
    suffix = '',
    prefix = '',
    label,
    locale = 'es'
}: CounterAnimationProps) => {
    const [elementRef, isVisible] = useViewportTrigger<HTMLDivElement>();
    const { value, isComplete } = useCountUp({
        target: targetValue,
        duration: 2000,
        isVisible,
        easing: 'quart'
    });

    const bcp47 = toBcp47Locale(locale);
    const formattedValue = formatNumber({ value, locale: bcp47 });

    return (
        <div
            ref={elementRef}
            className="flex flex-col items-center text-center"
        >
            <div className="font-bold text-[length:var(--fs-counter-number)] text-white">
                <span aria-hidden={isComplete ? undefined : 'true'}>
                    {prefix}
                    {formattedValue}
                    {suffix}
                </span>
            </div>
            <span
                aria-live="polite"
                className="sr-only"
            >
                {isComplete
                    ? `${prefix}${formatNumber({ value: targetValue, locale: bcp47 })}${suffix} ${label}`
                    : ''}
            </span>
            <div className="mt-2 font-medium text-sm text-white/80 uppercase tracking-wider">
                {label}
            </div>
        </div>
    );
};
