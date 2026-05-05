import { forwardRef } from 'react';
import styles from './Select.module.css';
import { cn } from './cn.js';

/** Props accepted by the Select component. */
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * Native `<select>` element styled to match the Input and Textarea primitives.
 *
 * Uses `appearance: none` to suppress the browser-default arrow and applies a
 * custom chevron via `background-image`. All colors come from CSS custom
 * properties in tokens.css — no host app CSS framework required.
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
                className={cn(styles.select, className)}
                {...props}
            >
                {children}
            </select>
        );
    }
);

Select.displayName = 'Select';
