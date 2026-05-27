import * as DialogPrimitive from '@radix-ui/react-dialog';
import { CloseIcon } from '@repo/icons';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Sheet root component.
 * Thin wrapper around Radix Dialog for side-panel drawers.
 */
function Sheet({ ...props }: React.ComponentProps<typeof DialogPrimitive.Root>) {
    return (
        <DialogPrimitive.Root
            data-slot="sheet"
            {...props}
        />
    );
}

/**
 * Sheet trigger — the element that opens the drawer when activated.
 */
function SheetTrigger({ ...props }: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
    return (
        <DialogPrimitive.Trigger
            data-slot="sheet-trigger"
            {...props}
        />
    );
}

/**
 * Sheet portal — renders children outside the DOM hierarchy.
 */
function SheetPortal({ ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) {
    return (
        <DialogPrimitive.Portal
            data-slot="sheet-portal"
            {...props}
        />
    );
}

/**
 * Sheet close button — closes the drawer when activated.
 */
function SheetClose({ ...props }: React.ComponentProps<typeof DialogPrimitive.Close>) {
    return (
        <DialogPrimitive.Close
            data-slot="sheet-close"
            {...props}
        />
    );
}

/**
 * Sheet overlay — semi-transparent backdrop that closes the drawer on click.
 */
function SheetOverlay({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
    return (
        <DialogPrimitive.Overlay
            data-slot="sheet-overlay"
            className={cn(
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=open]:animate-in',
                className
            )}
            {...props}
        />
    );
}

/**
 * Props for SheetContent. Only "right" side is supported in this implementation.
 */
type SheetContentProps = React.ComponentProps<typeof DialogPrimitive.Content> & {
    /** Which edge the drawer slides in from. Defaults to "right". */
    readonly side?: 'right';
    /** Whether to show the built-in close button. Defaults to true. */
    readonly showCloseButton?: boolean;
    /**
     * Mirror of the parent `<Sheet modal={…}>` prop.
     * When `false` the overlay is rendered with `pointer-events-none` so
     * the content behind the drawer remains fully interactive (no click blocking).
     * Defaults to `true` (standard modal overlay behaviour).
     */
    readonly 'data-modal'?: 'true' | 'false';
};

/**
 * Sheet content panel — slides in from the right side of the viewport.
 *
 * When `data-modal="false"` the overlay is `pointer-events-none` so the list
 * behind the drawer stays interactive (non-modal peek drawer behaviour).
 */
function SheetContent({
    className,
    children,
    side = 'right',
    showCloseButton = true,
    'data-modal': dataModal,
    ...props
}: SheetContentProps) {
    const isNonModal = dataModal === 'false';
    return (
        <SheetPortal data-slot="sheet-portal">
            <SheetOverlay className={isNonModal ? 'pointer-events-none' : undefined} />
            <DialogPrimitive.Content
                data-slot="sheet-content"
                data-side={side}
                className={cn(
                    // Base positioning: full height, fixed to the right edge
                    'fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col',
                    // Width: full on mobile, capped on sm+
                    'sm:max-w-md',
                    // Background and border
                    'border-border border-l bg-card shadow-xl',
                    // Slide-in animation from the right
                    'data-[state=closed]:animate-out data-[state=open]:animate-in',
                    'data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
                    'duration-300 ease-in-out',
                    className
                )}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <DialogPrimitive.Close
                        data-slot="sheet-close"
                        className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                        aria-label="Cerrar"
                    >
                        <CloseIcon />
                        <span className="sr-only">Cerrar</span>
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Content>
        </SheetPortal>
    );
}

/**
 * Sheet header — top section containing title and optional description.
 */
function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="sheet-header"
            className={cn('flex flex-col gap-2 border-border border-b px-6 py-4', className)}
            {...props}
        />
    );
}

/**
 * Sheet footer — bottom section containing action buttons.
 */
function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="sheet-footer"
            className={cn(
                'flex flex-col-reverse gap-2 border-border border-t px-6 py-4 sm:flex-row sm:justify-end',
                className
            )}
            {...props}
        />
    );
}

/**
 * Sheet title — main heading for the drawer.
 */
function SheetTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
    return (
        <DialogPrimitive.Title
            data-slot="sheet-title"
            className={cn('font-semibold text-foreground text-lg leading-none', className)}
            {...props}
        />
    );
}

/**
 * Sheet description — optional secondary text below the title.
 */
function SheetDescription({
    className,
    ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
    return (
        <DialogPrimitive.Description
            data-slot="sheet-description"
            className={cn('text-muted-foreground text-sm', className)}
            {...props}
        />
    );
}

export {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetOverlay,
    SheetPortal,
    SheetTitle,
    SheetTrigger
};
