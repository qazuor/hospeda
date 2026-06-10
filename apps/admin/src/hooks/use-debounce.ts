import { useEffect, useState } from 'react';

/**
 * Debounces a value by the specified delay.
 *
 * @param value - The value to debounce.
 * @param delay - Debounce delay in milliseconds.
 * @returns The debounced value, which updates only after `delay` ms of inactivity.
 */
export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(timer);
        };
    }, [value, delay]);

    return debouncedValue;
}
