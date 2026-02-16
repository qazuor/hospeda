import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Modal } from '../../../src/components/ui/Modal.client';

// Mock HTMLDialogElement methods (not supported in jsdom)
beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn();
    HTMLDialogElement.prototype.close = vi.fn();
});

describe('Modal.client.tsx', () => {
    describe('Props', () => {
        it('should accept title prop', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            expect(screen.getByText('Test Modal')).toBeInTheDocument();
        });

        it('should accept children prop', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    <p>Modal content here</p>
                </Modal>
            );
            expect(screen.getByText('Modal content here')).toBeInTheDocument();
        });

        it('should accept open prop', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const dialog = container.querySelector('dialog');
            expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
            expect(dialog).toBeInTheDocument();
        });

        it('should accept onClose callback', () => {
            const handleClose = vi.fn();
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={handleClose}
                >
                    Content
                </Modal>
            );

            const closeButton = screen.getByLabelText('Close modal');
            fireEvent.click(closeButton);

            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('should accept className prop', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                    className="custom-modal"
                >
                    Content
                </Modal>
            );
            const dialog = container.querySelector('dialog');
            expect(dialog).toHaveClass('custom-modal');
        });
    });

    describe('Rendering', () => {
        it('should render dialog element', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const dialog = container.querySelector('dialog');
            expect(dialog).toBeInTheDocument();
        });

        it('should render title in header', () => {
            render(
                <Modal
                    title="My Modal Title"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const title = screen.getByText('My Modal Title');
            expect(title).toBeInTheDocument();
            expect(title.tagName).toBe('H2');
        });

        it('should render close button', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const closeButton = screen.getByLabelText('Close modal');
            expect(closeButton).toBeInTheDocument();
            expect(closeButton.tagName).toBe('BUTTON');
        });

        it('should render children inside content area', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    <div data-testid="modal-content">Content here</div>
                </Modal>
            );
            expect(screen.getByTestId('modal-content')).toBeInTheDocument();
        });

        it('should render close icon SVG', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const closeButton = screen.getByLabelText('Close modal');
            const svg = closeButton.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });
    });

    describe('Accessibility', () => {
        it('should have aria-modal="true"', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const dialog = container.querySelector('dialog');
            expect(dialog).toHaveAttribute('aria-modal', 'true');
        });

        it('should use semantic dialog element (implicit role)', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const dialog = container.querySelector('dialog');
            expect(dialog).toBeInTheDocument();
            // Note: <dialog> element has implicit role="dialog", no need to set explicitly
        });

        it('should have aria-labelledby pointing to title', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const dialog = container.querySelector('dialog');
            const title = screen.getByText('Test Modal');

            expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
            expect(title).toHaveAttribute('id', 'modal-title');
        });

        it('should have aria-label on close button', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const closeButton = screen.getByLabelText('Close modal');
            expect(closeButton).toHaveAttribute('aria-label', 'Close modal');
        });

        it('should have aria-hidden on close icon SVG', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const closeButton = screen.getByLabelText('Close modal');
            const svg = closeButton.querySelector('svg');
            expect(svg).toHaveAttribute('aria-hidden', 'true');
        });

        it('should have focus-visible styles on close button', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const closeButton = screen.getByLabelText('Close modal');
            expect(closeButton.className).toContain('focus-visible:outline');
        });
    });

    describe('Interaction', () => {
        it('should call onClose when close button is clicked', () => {
            const handleClose = vi.fn();
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={handleClose}
                >
                    Content
                </Modal>
            );

            const closeButton = screen.getByLabelText('Close modal');
            fireEvent.click(closeButton);

            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose on Escape key (cancel event)', () => {
            const handleClose = vi.fn();
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={handleClose}
                >
                    Content
                </Modal>
            );

            const dialog = container.querySelector('dialog');
            if (dialog) {
                fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
            }

            expect(handleClose).toHaveBeenCalledTimes(1);
        });

        it('should call onClose when clicking backdrop (outside dialog)', () => {
            const handleClose = vi.fn();
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={handleClose}
                >
                    Content
                </Modal>
            );

            const dialog = container.querySelector('dialog');
            if (dialog) {
                // Mock getBoundingClientRect to simulate click outside
                vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
                    left: 100,
                    right: 500,
                    top: 100,
                    bottom: 400,
                    width: 400,
                    height: 300,
                    x: 100,
                    y: 100,
                    toJSON: () => {}
                });

                // Click outside (coordinates outside rect)
                fireEvent.click(dialog, { clientX: 50, clientY: 50 });
                expect(handleClose).toHaveBeenCalledTimes(1);
            }
        });

        it('should NOT call onClose when clicking inside dialog content', () => {
            const handleClose = vi.fn();
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={handleClose}
                >
                    Content
                </Modal>
            );

            const dialog = container.querySelector('dialog');
            if (dialog) {
                // Mock getBoundingClientRect
                vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
                    left: 100,
                    right: 500,
                    top: 100,
                    bottom: 400,
                    width: 400,
                    height: 300,
                    x: 100,
                    y: 100,
                    toJSON: () => {}
                });

                // Click inside (coordinates inside rect)
                fireEvent.click(dialog, { clientX: 300, clientY: 250 });
                expect(handleClose).not.toHaveBeenCalled();
            }
        });

        it('should call showModal when open prop is true', () => {
            vi.clearAllMocks();
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalled();
        });

        it('should call close when open prop changes to false', () => {
            vi.clearAllMocks();
            const { rerender, container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );

            const dialog = container.querySelector('dialog');
            if (dialog) {
                // Simulate dialog being open
                Object.defineProperty(dialog, 'open', {
                    value: true,
                    writable: true,
                    configurable: true
                });
            }

            rerender(
                <Modal
                    title="Test Modal"
                    open={false}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );

            expect(HTMLDialogElement.prototype.close).toHaveBeenCalled();
        });
    });

    describe('Styling', () => {
        it('should have rounded corners', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('rounded-lg');
        });

        it('should have border', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('border');
        });

        it('should have shadow', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('shadow-xl');
        });

        it('should have backdrop blur', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('backdrop:backdrop-blur-sm');
        });

        it('should have animation on open', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const dialog = container.querySelector('dialog');
            expect(dialog?.className).toContain('open:animate-fade-in');
        });

        it('should have hover styles on close button', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const closeButton = screen.getByLabelText('Close modal');
            expect(closeButton.className).toContain('hover:bg-gray-100');
        });

        it('should have transition on close button', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const closeButton = screen.getByLabelText('Close modal');
            expect(closeButton.className).toContain('transition-colors');
        });
    });

    describe('Button attributes', () => {
        it('should have type="button" on close button', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const closeButton = screen.getByLabelText('Close modal');
            expect(closeButton).toHaveAttribute('type', 'button');
        });

        it('should not be disabled by default', () => {
            render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const closeButton = screen.getByLabelText('Close modal');
            expect(closeButton).not.toBeDisabled();
        });
    });

    describe('Layout', () => {
        it('should have max width constraint', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const contentWrapper = container.querySelector('.max-w-2xl');
            expect(contentWrapper).toBeInTheDocument();
        });

        it('should have min width constraint', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const contentWrapper = container.querySelector('.min-w-\\[320px\\]');
            expect(contentWrapper).toBeInTheDocument();
        });

        it('should have max height constraint', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const contentWrapper = container.querySelector('.max-h-\\[90vh\\]');
            expect(contentWrapper).toBeInTheDocument();
        });

        it('should have scrollable content area', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const contentArea = container.querySelector('.overflow-y-auto');
            expect(contentArea).toBeInTheDocument();
        });

        it('should have border between header and content', () => {
            const { container } = render(
                <Modal
                    title="Test Modal"
                    open={true}
                    onClose={() => {}}
                >
                    Content
                </Modal>
            );
            const header = container.querySelector('.border-b');
            expect(header).toBeInTheDocument();
        });
    });
});
