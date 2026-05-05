import { forwardRef } from 'react';
import styles from './Label.module.css';
import { cn } from './cn.js';

/** Props accepted by the Label component. */
export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}

/**
 * Styled `<label>` primitive for use with form inputs in the feedback package.
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
                className={cn(styles.label, className)}
                {...props}
            />
        </>
    );
});

Label.displayName = 'Label';
