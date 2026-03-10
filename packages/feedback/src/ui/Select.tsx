import { forwardRef } from 'react';
import { cn } from './cn.js';

/** Props accepted by the Select component. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * Native `<select>` element styled to match the Input and Textarea primitives.
 *
 * Uses `appearance-none` to suppress the browser-default arrow and applies a
 * custom chevron via `bg-[url(...)]`. Relies on the same semantic tokens
 * (`border-input`, `bg-background`, `ring-ring`) as the other form primitives.
 *
 * Prefer this over Radix Select for simple, non-searchable option lists to keep
 * the feedback package free of Radix dependencies.
 *
 * @example
 * <Select value={category} onChange={e => setCategory(e.target.value)}>
 *   <option value="bug">Bug</option>
 *   <option value="feature">Feature request</option>
 * </Select>
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <select
                ref={ref}
                className={cn(
                    'flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-1',
                    'text-sm shadow-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    // biome-ignore lint/nursery/useSortedClasses: SVG data URL contains query-string tokens that must not be reordered
                    "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E\")] bg-[right_0.75rem_center] bg-no-repeat pr-9",
                    className
                )}
                {...props}
            >
                {children}
            </select>
        );
    }
);

Select.displayName = 'Select';
