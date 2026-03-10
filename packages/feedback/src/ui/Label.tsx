import { forwardRef } from 'react';
import { cn } from './cn.js';

/** Props accepted by the Label component. */
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

/**
 * Styled `<label>` primitive for use with form inputs in the feedback package.
 *
 * Uses `text-sm font-semibold text-foreground` via the host app's Tailwind token.
 * Accepts `htmlFor` and all standard label attributes.
 *
 * @example
 * <Label htmlFor="email">Email address</Label>
 * <Input id="email" type="email" />
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => {
    return (
        <>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: generic primitive - callers supply htmlFor or nest the control */}
            <label
                ref={ref}
                className={cn(
                    'block font-semibold text-foreground text-sm leading-none',
                    'peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                    className
                )}
                {...props}
            />
        </>
    );
});

Label.displayName = 'Label';
