import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareButtons } from '../../../src/components/ui/ShareButtons.client';
import type { ShareButtonsProps } from '../../../src/components/ui/ShareButtons.client';

describe('ShareButtons.client.tsx', () => {
    const defaultProps: ShareButtonsProps = {
        url: 'https://example.com/page',
        title: 'Test Page Title',
        text: 'Check out this amazing content'
    };

    // Store original navigator properties
    const originalNavigator = { ...navigator };

    afterEach(() => {
        // Restore navigator after each test
        Object.defineProperty(global, 'navigator', {
            writable: true,
            configurable: true,
            value: originalNavigator
        });
        vi.clearAllMocks();
    });

    describe('Props', () => {
        beforeEach(() => {
            // Mock Web Share API as unavailable for props tests
            Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        });

        it('should accept url prop', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on WhatsApp')).toBeInTheDocument();
        });

        it('should accept title prop', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on WhatsApp')).toBeInTheDocument();
        });

        it('should accept optional text prop', () => {
            render(
                <ShareButtons
                    url={defaultProps.url}
                    title={defaultProps.title}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on WhatsApp')).toBeInTheDocument();
        });

        it('should accept className prop', () => {
            const { container } = render(
                <ShareButtons
                    {...defaultProps}
                    className="custom-class"
                    locale="en"
                />
            );
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass('custom-class');
        });

        it('should apply default className when not provided', () => {
            const { container } = render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass('flex', 'gap-2', 'items-center');
        });
    });

    describe('Rendering - Web Share API available', () => {
        beforeEach(() => {
            // Mock Web Share API as available
            Object.defineProperty(navigator, 'share', {
                writable: true,
                configurable: true,
                value: vi.fn().mockResolvedValue(undefined)
            });
        });

        it('should render native share button when Web Share API is available', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share via device')).toBeInTheDocument();
        });

        it('should not render social links when Web Share API is available', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.queryByLabelText('Share on WhatsApp')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Share on Facebook')).not.toBeInTheDocument();
            expect(screen.queryByLabelText('Share on Twitter')).not.toBeInTheDocument();
        });

        it('should still render copy to clipboard button when Web Share API is available', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Copy link to clipboard')).toBeInTheDocument();
        });
    });

    describe('Rendering - Web Share API not available', () => {
        beforeEach(() => {
            // Mock Web Share API as unavailable
            Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        });

        it('should render WhatsApp share link', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on WhatsApp')).toBeInTheDocument();
        });

        it('should render Facebook share link', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on Facebook')).toBeInTheDocument();
        });

        it('should render Twitter share link', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on Twitter')).toBeInTheDocument();
        });

        it('should render copy to clipboard button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Copy link to clipboard')).toBeInTheDocument();
        });

        it('should not render native share button when Web Share API is unavailable', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.queryByLabelText('Share via device')).not.toBeInTheDocument();
        });
    });

    describe('Social share link URLs', () => {
        beforeEach(() => {
            // Mock Web Share API as unavailable to render social links
            Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        });

        it('should generate correct WhatsApp URL with text', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const whatsappLink = screen.getByLabelText('Share on WhatsApp');
            const expectedMessage = `${defaultProps.title} - ${defaultProps.text} ${defaultProps.url}`;
            expect(whatsappLink).toHaveAttribute(
                'href',
                `https://wa.me/?text=${encodeURIComponent(expectedMessage)}`
            );
        });

        it('should generate correct WhatsApp URL without text', () => {
            render(
                <ShareButtons
                    url={defaultProps.url}
                    title={defaultProps.title}
                    locale="en"
                />
            );
            const whatsappLink = screen.getByLabelText('Share on WhatsApp');
            const expectedMessage = `${defaultProps.title} ${defaultProps.url}`;
            expect(whatsappLink).toHaveAttribute(
                'href',
                `https://wa.me/?text=${encodeURIComponent(expectedMessage)}`
            );
        });

        it('should generate correct Facebook URL', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const facebookLink = screen.getByLabelText('Share on Facebook');
            expect(facebookLink).toHaveAttribute(
                'href',
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(defaultProps.url)}`
            );
        });

        it('should generate correct Twitter URL with text', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const twitterLink = screen.getByLabelText('Share on Twitter');
            const expectedText = `${defaultProps.title} - ${defaultProps.text}`;
            expect(twitterLink).toHaveAttribute(
                'href',
                `https://twitter.com/intent/tweet?url=${encodeURIComponent(defaultProps.url)}&text=${encodeURIComponent(expectedText)}`
            );
        });

        it('should generate correct Twitter URL without text', () => {
            render(
                <ShareButtons
                    url={defaultProps.url}
                    title={defaultProps.title}
                    locale="en"
                />
            );
            const twitterLink = screen.getByLabelText('Share on Twitter');
            expect(twitterLink).toHaveAttribute(
                'href',
                `https://twitter.com/intent/tweet?url=${encodeURIComponent(defaultProps.url)}&text=${encodeURIComponent(defaultProps.title)}`
            );
        });
    });

    describe('Social links attributes', () => {
        beforeEach(() => {
            // Mock Web Share API as unavailable
            Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        });

        it('should have target="_blank" on WhatsApp link', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const link = screen.getByLabelText('Share on WhatsApp');
            expect(link).toHaveAttribute('target', '_blank');
        });

        it('should have rel="noopener noreferrer" on WhatsApp link', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const link = screen.getByLabelText('Share on WhatsApp');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });

        it('should have target="_blank" on Facebook link', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const link = screen.getByLabelText('Share on Facebook');
            expect(link).toHaveAttribute('target', '_blank');
        });

        it('should have rel="noopener noreferrer" on Facebook link', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const link = screen.getByLabelText('Share on Facebook');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });

        it('should have target="_blank" on Twitter link', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const link = screen.getByLabelText('Share on Twitter');
            expect(link).toHaveAttribute('target', '_blank');
        });

        it('should have rel="noopener noreferrer" on Twitter link', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const link = screen.getByLabelText('Share on Twitter');
            expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        });
    });

    describe('Copy to clipboard functionality', () => {
        beforeEach(() => {
            // Mock Web Share API as unavailable
            Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });

            // Mock clipboard API
            Object.defineProperty(navigator, 'clipboard', {
                writable: true,
                configurable: true,
                value: {
                    writeText: vi.fn().mockResolvedValue(undefined)
                }
            });
        });

        it('should copy URL to clipboard when copy button is clicked', async () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );

            const copyButton = screen.getByLabelText('Copy link to clipboard');
            fireEvent.click(copyButton);

            await waitFor(() => {
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultProps.url);
            });
        });

        it('should show "Copied!" feedback after copying', async () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );

            const copyButton = screen.getByLabelText('Copy link to clipboard');
            fireEvent.click(copyButton);

            await waitFor(() => {
                expect(screen.getByText('Copied!')).toBeInTheDocument();
            });
        });

        it('should update aria-label to "Link copied" after copying', async () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );

            const copyButton = screen.getByLabelText('Copy link to clipboard');
            fireEvent.click(copyButton);

            await waitFor(() => {
                expect(screen.getByLabelText('Link copied')).toBeInTheDocument();
            });
        });

        it('should hide "Copied!" feedback after 2 seconds', async () => {
            vi.useFakeTimers();

            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );

            const copyButton = screen.getByLabelText('Copy link to clipboard');

            await act(async () => {
                fireEvent.click(copyButton);
            });

            // Check that "Copied!" appears
            expect(screen.getByText('Copied!')).toBeInTheDocument();

            // Fast forward time by 2000ms
            await act(async () => {
                vi.advanceTimersByTime(2000);
            });

            // Check that "Copied!" disappears
            expect(screen.queryByText('Copied!')).not.toBeInTheDocument();

            vi.useRealTimers();
        });

        it('should handle clipboard write failure gracefully', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Override clipboard for this specific test
            const originalClipboard = navigator.clipboard;
            const writeTextMock = vi.fn().mockRejectedValue(new Error('Clipboard error'));

            Object.defineProperty(navigator, 'clipboard', {
                writable: true,
                configurable: true,
                value: {
                    writeText: writeTextMock
                }
            });

            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );

            const copyButton = screen.getByLabelText('Copy link to clipboard');

            // Click the button
            fireEvent.click(copyButton);

            // Wait for the async handler to complete
            await vi.waitFor(() => {
                expect(writeTextMock).toHaveBeenCalled();
            });

            // Give a small delay for console.error to be called
            await vi.waitFor(
                () => {
                    expect(consoleErrorSpy).toHaveBeenCalledWith('Copy failed:', expect.any(Error));
                },
                { timeout: 100 }
            );

            // Restore
            Object.defineProperty(navigator, 'clipboard', {
                writable: true,
                configurable: true,
                value: originalClipboard
            });
            consoleErrorSpy.mockRestore();
        });
    });

    describe('Web Share API functionality', () => {
        beforeEach(() => {
            // Mock Web Share API as available
            Object.defineProperty(navigator, 'share', {
                writable: true,
                configurable: true,
                value: vi.fn().mockResolvedValue(undefined)
            });
        });

        it('should call navigator.share when share button is clicked', async () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );

            const shareButton = screen.getByLabelText('Share via device');

            await act(async () => {
                fireEvent.click(shareButton);
            });

            expect(navigator.share).toHaveBeenCalledWith({
                url: defaultProps.url,
                title: defaultProps.title,
                text: defaultProps.text
            });
        });

        it('should call navigator.share without text when not provided', async () => {
            render(
                <ShareButtons
                    url={defaultProps.url}
                    title={defaultProps.title}
                    locale="en"
                />
            );

            const shareButton = screen.getByLabelText('Share via device');

            await act(async () => {
                fireEvent.click(shareButton);
            });

            expect(navigator.share).toHaveBeenCalledWith({
                url: defaultProps.url,
                title: defaultProps.title,
                text: ''
            });
        });

        it('should handle share cancellation gracefully', async () => {
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            // Override share for this specific test
            const shareMock = vi.fn().mockRejectedValue(new Error('Share cancelled'));

            Object.defineProperty(navigator, 'share', {
                writable: true,
                configurable: true,
                value: shareMock
            });

            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );

            const shareButton = screen.getByLabelText('Share via device');

            // Click the button
            fireEvent.click(shareButton);

            // Wait for the async handler to complete
            await vi.waitFor(() => {
                expect(shareMock).toHaveBeenCalled();
            });

            // Give a small delay for console.error to be called
            await vi.waitFor(
                () => {
                    expect(consoleErrorSpy).toHaveBeenCalledWith(
                        'Share failed:',
                        expect.any(Error)
                    );
                },
                { timeout: 100 }
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe('Accessibility', () => {
        beforeEach(() => {
            // Mock Web Share API as unavailable to test all buttons
            Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        });

        it('should have aria-label on WhatsApp button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on WhatsApp')).toBeInTheDocument();
        });

        it('should have aria-label on Facebook button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on Facebook')).toBeInTheDocument();
        });

        it('should have aria-label on Twitter button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on Twitter')).toBeInTheDocument();
        });

        it('should have aria-label on copy button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Copy link to clipboard')).toBeInTheDocument();
        });

        it('should have aria-hidden on SVG icons', () => {
            const { container } = render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const icons = Array.from(container.querySelectorAll('svg'));
            for (const icon of icons) {
                expect(icon).toHaveAttribute('aria-hidden', 'true');
            }
        });

        it('should have aria-live on "Copied!" feedback', async () => {
            // Override clipboard for this specific test
            const writeTextMock = vi.fn().mockResolvedValue(undefined);

            Object.defineProperty(navigator, 'clipboard', {
                writable: true,
                configurable: true,
                value: {
                    writeText: writeTextMock
                }
            });

            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );

            const copyButton = screen.getByLabelText('Copy link to clipboard');

            await act(async () => {
                fireEvent.click(copyButton);
            });

            // Wait for the writeText to be called
            await vi.waitFor(() => {
                expect(writeTextMock).toHaveBeenCalled();
            });

            // Check that feedback appears with aria-live
            await vi.waitFor(
                () => {
                    const feedback = screen.getByText('Copied!');
                    expect(feedback).toHaveAttribute('aria-live', 'polite');
                },
                { timeout: 100 }
            );
        });

        it('should have type="button" on all buttons', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const copyButton = screen.getByLabelText('Copy link to clipboard');
            expect(copyButton).toHaveAttribute('type', 'button');
        });
    });

    describe('Styling', () => {
        beforeEach(() => {
            // Mock Web Share API as unavailable
            Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
        });

        it('should have focus-visible styles on WhatsApp button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const button = screen.getByLabelText('Share on WhatsApp');
            expect(button.className).toContain('focus-visible:outline');
        });

        it('should have focus-visible styles on Facebook button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const button = screen.getByLabelText('Share on Facebook');
            expect(button.className).toContain('focus-visible:outline');
        });

        it('should have focus-visible styles on Twitter button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const button = screen.getByLabelText('Share on Twitter');
            expect(button.className).toContain('focus-visible:outline');
        });

        it('should have focus-visible styles on copy button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const button = screen.getByLabelText('Copy link to clipboard');
            expect(button.className).toContain('focus-visible:outline');
        });

        it('should have transition styles on buttons', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const copyButton = screen.getByLabelText('Copy link to clipboard');
            expect(copyButton.className).toContain('transition-colors');
        });

        it('should have proper styling classes on container', () => {
            const { container } = render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const wrapper = container.firstChild as HTMLElement;
            expect(wrapper).toHaveClass('flex', 'gap-2', 'items-center');
        });

        it('should have rounded corners on social buttons', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const whatsappButton = screen.getByLabelText('Share on WhatsApp');
            expect(whatsappButton.className).toContain('rounded-full');
        });
    });
});
