/** Shared kit close control for drawers and sheets. Callers supply a translated label. */
import { CloseIcon } from '@repo/icons';
import { Button, type ButtonProps } from './Button';

type CloseButtonProps = Pick<ButtonProps, 'aria-label' | 'onClick' | 'ref' | 'tabIndex'> & {
    readonly 'aria-label': string;
};

export function CloseButton(props: CloseButtonProps) {
    return (
        <Button
            {...props}
            variant="quiet"
            size="sm"
            iconOnly
        >
            <CloseIcon
                size="sm"
                weight="regular"
                color="currentColor"
                aria-hidden="true"
            />
        </Button>
    );
}
