import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContainer } from '../../../src/components/ui/Toast.client';
import { addToast, clearToasts } from '../../../src/store/toast-store';

describe('Toast.client.tsx', () => {
    beforeEach(() => {
        clearToasts();
        vi.useFakeTimers();
    });

    afterEach(() => {
        clearToasts();
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    describe('Rendering', () => {
        it('should render container with aria-live="polite"', () => {
            const { container } = render(<ToastContainer />);
            const toastContainer = container.querySelector('[aria-live="polite"]');
            expect(toastContainer).toBeInTheDocument();
        });

        it('should render empty container when no toasts', () => {
            const { container } = render(<ToastContainer />);
            const toastContainer = container.querySelector('[aria-live="polite"]');
            expect(toastContainer?.children).toHaveLength(0);
        });

        it('should render toast when added', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test message' });
            });

            const toast = screen.getByRole('alert');
            expect(toast).toBeInTheDocument();
            expect(toast).toHaveTextContent('Test message');
        });

        it('should render multiple toasts', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'First toast' });
                addToast({ type: 'error', message: 'Second toast' });
                addToast({ type: 'warning', message: 'Third toast' });
            });

            const toasts = screen.getAllByRole('alert');
            expect(toasts).toHaveLength(3);
            expect(toasts[0]).toHaveTextContent('First toast');
            expect(toasts[1]).toHaveTextContent('Second toast');
            expect(toasts[2]).toHaveTextContent('Third toast');
        });

        it('should render toast with close button', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const closeButton = screen.getByLabelText('Close notification');
            expect(closeButton).toBeInTheDocument();
            expect(closeButton.tagName).toBe('BUTTON');
        });
    });

    describe('Toast Types', () => {
        it('should render success toast with green styling', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Success message' });
            });

            const toast = screen.getByRole('alert');
            expect(toast.className).toContain('bg-green-50');
            expect(toast.className).toContain('text-green-800');
            expect(toast.className).toContain('border-green-200');
        });

        it('should render error toast with red styling', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'error', message: 'Error message' });
            });

            const toast = screen.getByRole('alert');
            expect(toast.className).toContain('bg-red-50');
            expect(toast.className).toContain('text-red-800');
            expect(toast.className).toContain('border-red-200');
        });

        it('should render warning toast with yellow styling', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'warning', message: 'Warning message' });
            });

            const toast = screen.getByRole('alert');
            expect(toast.className).toContain('bg-yellow-50');
            expect(toast.className).toContain('text-yellow-800');
            expect(toast.className).toContain('border-yellow-200');
        });

        it('should render info toast with blue styling', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'info', message: 'Info message' });
            });

            const toast = screen.getByRole('alert');
            expect(toast.className).toContain('bg-blue-50');
            expect(toast.className).toContain('text-blue-800');
            expect(toast.className).toContain('border-blue-200');
        });

        it('should render appropriate icon for success toast', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Success' });
            });

            const toast = screen.getByRole('alert');
            const svg = toast.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('aria-hidden', 'true');
        });

        it('should render appropriate icon for error toast', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'error', message: 'Error' });
            });

            const toast = screen.getByRole('alert');
            const svg = toast.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('aria-hidden', 'true');
        });

        it('should render appropriate icon for warning toast', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'warning', message: 'Warning' });
            });

            const toast = screen.getByRole('alert');
            const svg = toast.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('aria-hidden', 'true');
        });

        it('should render appropriate icon for info toast', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'info', message: 'Info' });
            });

            const toast = screen.getByRole('alert');
            const svg = toast.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('aria-hidden', 'true');
        });
    });

    describe('Accessibility', () => {
        it('should have role="alert" on each toast', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test 1' });
                addToast({ type: 'error', message: 'Test 2' });
            });

            const toasts = screen.getAllByRole('alert');
            expect(toasts).toHaveLength(2);
            for (const toast of toasts) {
                expect(toast).toHaveAttribute('role', 'alert');
            }
        });

        it('should have aria-live="polite" on container', () => {
            const { container } = render(<ToastContainer />);
            const toastContainer = container.querySelector('[aria-live="polite"]');
            expect(toastContainer).toHaveAttribute('aria-live', 'polite');
        });

        it('should have aria-label on close button', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const closeButton = screen.getByLabelText('Close notification');
            expect(closeButton).toHaveAttribute('aria-label', 'Close notification');
        });

        it('should have aria-hidden on icons', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const toast = screen.getByRole('alert');
            const svgs = Array.from(toast.querySelectorAll('svg'));

            for (const svg of svgs) {
                expect(svg).toHaveAttribute('aria-hidden', 'true');
            }
        });

        it('should have focus-visible styles on close button', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const closeButton = screen.getByLabelText('Close notification');
            expect(closeButton.className).toContain('focus-visible:outline');
        });

        it('should have type="button" on close button', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const closeButton = screen.getByLabelText('Close notification');
            expect(closeButton).toHaveAttribute('type', 'button');
        });
    });

    describe('Interaction', () => {
        it('should remove toast when close button is clicked', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test toast' });
            });

            expect(screen.getByRole('alert')).toBeInTheDocument();

            const closeButton = screen.getByLabelText('Close notification');
            fireEvent.click(closeButton);

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('should remove only clicked toast when multiple exist', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'First toast' });
                addToast({ type: 'error', message: 'Second toast' });
                addToast({ type: 'warning', message: 'Third toast' });
            });

            const closeButtons = screen.getAllByLabelText('Close notification');
            expect(closeButtons).toHaveLength(3);

            // Close second toast
            fireEvent.click(closeButtons[1] as HTMLElement);

            const remainingToasts = screen.getAllByRole('alert');
            expect(remainingToasts).toHaveLength(2);
            expect(remainingToasts[0]).toHaveTextContent('First toast');
            expect(remainingToasts[1]).toHaveTextContent('Third toast');
        });

        it('should update when toasts are added dynamically', () => {
            render(<ToastContainer />);

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();

            act(() => {
                addToast({ type: 'success', message: 'Dynamic toast' });
            });

            expect(screen.getByRole('alert')).toBeInTheDocument();
            expect(screen.getByRole('alert')).toHaveTextContent('Dynamic toast');
        });

        it('should update when toasts are removed dynamically', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Toast 1' });
                addToast({ type: 'error', message: 'Toast 2' });
            });

            expect(screen.getAllByRole('alert')).toHaveLength(2);

            // Trigger removal by clicking close on first toast
            const closeButtons = screen.getAllByLabelText('Close notification');
            fireEvent.click(closeButtons[0] as HTMLElement);

            expect(screen.getAllByRole('alert')).toHaveLength(1);
        });
    });

    describe('Styling', () => {
        it('should have fixed positioning', () => {
            const { container } = render(<ToastContainer />);
            const toastContainer = container.querySelector('[aria-live="polite"]');
            expect(toastContainer?.className).toContain('fixed');
        });

        it('should be positioned top-right', () => {
            const { container } = render(<ToastContainer />);
            const toastContainer = container.querySelector('[aria-live="polite"]');
            expect(toastContainer?.className).toContain('top-4');
            expect(toastContainer?.className).toContain('right-4');
        });

        it('should have high z-index', () => {
            const { container } = render(<ToastContainer />);
            const toastContainer = container.querySelector('[aria-live="polite"]');
            expect(toastContainer?.className).toContain('z-50');
        });

        it('should have slide-in animation on toast', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const toast = screen.getByRole('alert');
            expect(toast.className).toContain('animate-slide-in-right');
        });

        it('should have transition classes on toast', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const toast = screen.getByRole('alert');
            expect(toast.className).toContain('transition-all');
            expect(toast.className).toContain('duration-300');
        });

        it('should have rounded corners on toast', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const toast = screen.getByRole('alert');
            expect(toast.className).toContain('rounded-lg');
        });

        it('should have border on toast', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const toast = screen.getByRole('alert');
            expect(toast.className).toContain('border');
        });

        it('should have shadow on toast', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const toast = screen.getByRole('alert');
            expect(toast.className).toContain('shadow-lg');
        });

        it('should have max-width on toast', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const toast = screen.getByRole('alert');
            expect(toast.className).toContain('max-w-sm');
        });

        it('should have hover styles on close button', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Test' });
            });

            const closeButton = screen.getByLabelText('Close notification');
            expect(closeButton.className).toContain('hover:opacity-70');
        });

        it('should display toasts in flex column layout', () => {
            const { container } = render(<ToastContainer />);
            const toastContainer = container.querySelector('[aria-live="polite"]');
            expect(toastContainer?.className).toContain('flex');
            expect(toastContainer?.className).toContain('flex-col');
        });

        it('should have gap between toasts', () => {
            const { container } = render(<ToastContainer />);
            const toastContainer = container.querySelector('[aria-live="polite"]');
            expect(toastContainer?.className).toContain('gap-3');
        });
    });

    describe('Auto-dismiss', () => {
        it('should auto-dismiss toast after duration', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'Auto dismiss', duration: 5000 });
            });

            expect(screen.getByRole('alert')).toBeInTheDocument();

            act(() => {
                vi.advanceTimersByTime(5000);
            });

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });

        it('should auto-dismiss multiple toasts independently', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'First', duration: 3000 });
                addToast({ type: 'error', message: 'Second', duration: 5000 });
            });

            expect(screen.getAllByRole('alert')).toHaveLength(2);

            act(() => {
                vi.advanceTimersByTime(3000);
            });

            expect(screen.getAllByRole('alert')).toHaveLength(1);
            expect(screen.getByRole('alert')).toHaveTextContent('Second');

            act(() => {
                vi.advanceTimersByTime(2000);
            });

            expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        });
    });

    describe('Message Display', () => {
        it('should display message text', () => {
            render(<ToastContainer />);

            act(() => {
                addToast({ type: 'success', message: 'This is a test message' });
            });

            expect(screen.getByRole('alert')).toHaveTextContent('This is a test message');
        });

        it('should display long message text', () => {
            render(<ToastContainer />);

            const longMessage =
                'This is a very long message that should be displayed correctly in the toast notification component.';

            act(() => {
                addToast({ type: 'info', message: longMessage });
            });

            expect(screen.getByRole('alert')).toHaveTextContent(longMessage);
        });

        it('should handle special characters in message', () => {
            render(<ToastContainer />);

            const specialMessage = 'Message with <special> & "quoted" characters!';

            act(() => {
                addToast({ type: 'warning', message: specialMessage });
            });

            expect(screen.getByRole('alert')).toHaveTextContent(specialMessage);
        });
    });
});
