import { cn } from '@/lib/utils';
import { CheckInIcon, CloseIcon, LoaderIcon } from '@repo/icons';
import type { ReactNode } from 'react';
import React from 'react';

type OptimisticState = 'idle' | 'pending' | 'success' | 'error';

type OptimisticFeedbackProps = {
    readonly state: OptimisticState;
    readonly children: ReactNode;
    readonly className?: string;
    readonly showIndicator?: boolean;
    readonly indicatorPosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
    readonly successMessage?: string;
    readonly errorMessage?: string;
    readonly pendingMessage?: string;
};

/**
 * Component that provides visual feedback for optimistic updates
 * Shows loading, success, and error states with optional indicators
 */
export const OptimisticFeedback = ({
    state,
    children,
    className,
    showIndicator = true,
    indicatorPosition = 'top-right',
    successMessage,
    errorMessage,
    pendingMessage
}: OptimisticFeedbackProps) => {
    const getStateStyles = () => {
        switch (state) {
            case 'pending':
                return {
                    container: 'opacity-70 pointer-events-none',
                    indicator: 'bg-blue-500 text-white',
                    icon: LoaderIcon,
                    message: pendingMessage || 'Saving...'
                };
            case 'success':
                return {
                    container: 'transition-all duration-300 ease-in-out',
                    indicator: 'bg-green-500 text-white',
                    icon: CheckInIcon,
                    message: successMessage || 'Saved!'
                };
            case 'error':
                return {
                    container: 'border-red-200 bg-red-50',
                    indicator: 'bg-red-500 text-white',
                    icon: CloseIcon,
                    message: errorMessage || 'Error'
                };
            default:
                return {
                    container: '',
                    indicator: '',
                    icon: null,
                    message: ''
                };
        }
    };

    const getIndicatorPositionStyles = () => {
        switch (indicatorPosition) {
            case 'top-left':
                return 'top-1 left-1';
            case 'top-right':
                return 'top-1 right-1';
            case 'bottom-left':
                return 'bottom-1 left-1';
            case 'bottom-right':
                return 'bottom-1 right-1';
            default:
                return 'top-1 right-1';
        }
    };

    const styles = getStateStyles();
    const IconComponent = styles.icon;

    return (
        <div className={cn('relative transition-all duration-200', styles.container, className)}>
            {children}

            {/* State Indicator */}
            {showIndicator && state !== 'idle' && IconComponent && (
                <div
                    className={cn(
                        'absolute z-10 flex h-6 w-6 items-center justify-center rounded-full shadow-sm',
                        styles.indicator,
                        getIndicatorPositionStyles()
                    )}
                    title={styles.message}
                >
                    <IconComponent
                        className={cn('h-3 w-3', state === 'pending' && 'animate-spin')}
                    />
                </div>
            )}
        </div>
    );
};

/**
 * Hook to manage optimistic state transitions
 */
export const useOptimisticState = (initialState: OptimisticState = 'idle') => {
    const [state, setState] = React.useState<OptimisticState>(initialState);

    const setPending = () => setState('pending');
    const setSuccess = (duration = 2000) => {
        setState('success');
        if (duration > 0) {
            setTimeout(() => setState('idle'), duration);
        }
    };
    const setError = (duration = 5000) => {
        setState('error');
        if (duration > 0) {
            setTimeout(() => setState('idle'), duration);
        }
    };
    const setIdle = () => setState('idle');

    return {
        state,
        setPending,
        setSuccess,
        setError,
        setIdle,
        isPending: state === 'pending',
        isSuccess: state === 'success',
        isError: state === 'error',
        isIdle: state === 'idle'
    };
};

/**
 * Component for showing optimistic updates in list items
 */
type OptimisticListItemProps = {
    readonly children: ReactNode;
    readonly isOptimistic?: boolean;
    readonly isDeleting?: boolean;
    readonly isUpdating?: boolean;
    readonly hasError?: boolean;
    readonly className?: string;
};

export const OptimisticListItem = ({
    children,
    isOptimistic = false,
    isDeleting = false,
    isUpdating = false,
    hasError = false,
    className
}: OptimisticListItemProps) => {
    const getState = (): OptimisticState => {
        if (hasError) return 'error';
        if (isDeleting || isUpdating) return 'pending';
        if (isOptimistic) return 'success';
        return 'idle';
    };

    const getMessage = () => {
        if (isDeleting) return 'Deleting...';
        if (isUpdating) return 'Updating...';
        if (isOptimistic) return 'Changes saved';
        return '';
    };

    return (
        <OptimisticFeedback
            state={getState()}
            className={cn(
                'rounded-lg border transition-all duration-200',
                isDeleting && 'scale-95 opacity-50',
                isOptimistic && 'border-green-200 bg-green-50',
                hasError && 'border-red-200 bg-red-50',
                className
            )}
            pendingMessage={getMessage()}
            showIndicator={isDeleting || isUpdating || isOptimistic || hasError}
        >
            {children}
        </OptimisticFeedback>
    );
};

/**
 * Component for bulk operation feedback
 */
type BulkOperationFeedbackProps = {
    readonly operation: 'update' | 'delete' | null;
    readonly selectedCount: number;
    readonly isPending: boolean;
    readonly isSuccess: boolean;
    readonly isError: boolean;
    readonly className?: string;
};

export const BulkOperationFeedback = ({
    operation,
    selectedCount,
    isPending,
    isSuccess,
    isError,
    className
}: BulkOperationFeedbackProps) => {
    if (!operation || selectedCount === 0) return null;

    // Determine the current state based on props
    // const getState = (): OptimisticState => {
    //     if (isError) return 'error';
    //     if (isPending) return 'pending';
    //     if (isSuccess) return 'success';
    //     return 'idle';
    // };

    const getMessage = () => {
        const action = operation === 'delete' ? 'Deleting' : 'Updating';
        const items = selectedCount === 1 ? 'item' : 'items';

        if (isPending) return `${action} ${selectedCount} ${items}...`;
        if (isSuccess) return `Successfully ${operation}d ${selectedCount} ${items}`;
        if (isError) return `Failed to ${operation} ${selectedCount} ${items}`;
        return '';
    };

    return (
        <div
            className={cn(
                'fixed right-4 bottom-4 z-50 rounded-lg border bg-white p-4 shadow-lg',
                isPending && 'border-blue-200 bg-blue-50',
                isSuccess && 'border-green-200 bg-green-50',
                isError && 'border-red-200 bg-red-50',
                className
            )}
        >
            <div className="flex items-center space-x-3">
                {isPending && <LoaderIcon className="h-5 w-5 animate-spin text-blue-600" />}
                {isSuccess && <CheckInIcon className="h-5 w-5 text-green-600" />}
                {isError && <CloseIcon className="h-5 w-5 text-red-600" />}
                <span className="font-medium text-sm">{getMessage()}</span>
            </div>
        </div>
    );
};
