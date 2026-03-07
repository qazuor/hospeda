/**
 * @file share-buttons.test.tsx
 * @description Tests for ShareButtons.client.tsx component.
 *
 * Covers rendering with and without the Web Share API, social share link
 * URL construction, copy-to-clipboard behavior, copied state feedback,
 * Web Share API invocation, and accessibility attributes.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShareButtons } from '../../../src/components/shared/ShareButtons.client';
import type { ShareButtonsProps } from '../../../src/components/shared/ShareButtons.client';

/** Maps i18n keys to their English display values for test assertions. */
const EN_LABELS: Record<string, string> = {
    'accessibility.shareViaDevice': 'Share via device',
    'accessibility.shareOnWhatsApp': 'Share on WhatsApp',
    'accessibility.shareOnFacebook': 'Share on Facebook',
    'accessibility.shareOnTwitter': 'Share on Twitter',
    'accessibility.copyLink': 'Copy link to clipboard',
    'accessibility.linkCopied': 'Link copied',
    'share.label': 'Share',
    'share.copied': 'Copiado!'
};

vi.mock('../../../src/hooks/useTranslation', () => ({
    useTranslation: () => ({
        t: (key: string, fallback?: string) => EN_LABELS[key] ?? fallback ?? key,
        tPlural: (key: string, _n: number, fallback?: string) => fallback ?? key
    })
}));

vi.mock('@repo/icons', () => ({
    CheckIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="check"
        />
    ),
    CopyIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="copy"
        />
    ),
    FacebookIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="facebook"
        />
    ),
    ShareIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="share"
        />
    ),
    TwitterIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="twitter"
        />
    ),
    WhatsappIcon: () => (
        <svg
            aria-hidden="true"
            data-icon="whatsapp"
        />
    )
}));

const { webLoggerErrorMock } = vi.hoisted(() => ({
    webLoggerErrorMock: vi.fn()
}));

vi.mock('../../../src/lib/logger', () => ({
    webLogger: {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: webLoggerErrorMock,
        debug: vi.fn()
    }
}));

const defaultProps: ShareButtonsProps = {
    url: 'https://hospeda.com.ar/es/alojamientos/casa-del-rio',
    title: 'Casa del Rio',
    text: 'Alojamiento ideal para descansar'
};

describe('ShareButtons.client.tsx', () => {
    const originalNavigator = { ...navigator };

    afterEach(() => {
        Object.defineProperty(global, 'navigator', {
            writable: true,
            configurable: true,
            value: originalNavigator
        });
        vi.clearAllMocks();
    });

    describe('Props', () => {
        beforeEach(() => {
            Object.defineProperty(navigator, 'share', {
                value: undefined,
                configurable: true
            });
        });

        it('should accept url, title, and text props', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on WhatsApp')).toBeInTheDocument();
        });

        it('should render without optional text prop', () => {
            render(
                <ShareButtons
                    url={defaultProps.url}
                    title={defaultProps.title}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on WhatsApp')).toBeInTheDocument();
        });

        it('should apply className prop to the container element', () => {
            const { container } = render(
                <ShareButtons
                    {...defaultProps}
                    className="custom-share"
                    locale="en"
                />
            );
            expect(container.firstChild).toHaveClass('custom-share');
        });

        it('should have flex layout classes on the container by default', () => {
            const { container } = render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(container.firstChild).toHaveClass('flex', 'items-center', 'gap-2');
        });
    });

    describe('Web Share API available', () => {
        beforeEach(() => {
            Object.defineProperty(navigator, 'share', {
                writable: true,
                configurable: true,
                value: vi.fn().mockResolvedValue(undefined)
            });
        });

        it('should render the native share button when Web Share API is available', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share via device')).toBeInTheDocument();
        });

        it('should not render social link buttons when Web Share API is available', () => {
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

        it('should still render the copy-to-clipboard button when Web Share API is available', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Copy link to clipboard')).toBeInTheDocument();
        });
    });

    describe('Web Share API unavailable (fallback mode)', () => {
        beforeEach(() => {
            Object.defineProperty(navigator, 'share', {
                value: undefined,
                configurable: true
            });
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

        it('should render copy-to-clipboard button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Copy link to clipboard')).toBeInTheDocument();
        });

        it('should not render native share button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.queryByLabelText('Share via device')).not.toBeInTheDocument();
        });
    });

    describe('Social share URL construction', () => {
        beforeEach(() => {
            Object.defineProperty(navigator, 'share', {
                value: undefined,
                configurable: true
            });
        });

        it('should build correct WhatsApp URL with title, text, and url', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const whatsappLink = screen.getByLabelText('Share on WhatsApp');
            const expected = `${defaultProps.title} - ${defaultProps.text} ${defaultProps.url}`;
            expect(whatsappLink).toHaveAttribute(
                'href',
                `https://wa.me/?text=${encodeURIComponent(expected)}`
            );
        });

        it('should build correct WhatsApp URL with title only (no text)', () => {
            render(
                <ShareButtons
                    url={defaultProps.url}
                    title={defaultProps.title}
                    locale="en"
                />
            );
            const expected = `${defaultProps.title} ${defaultProps.url}`;
            expect(screen.getByLabelText('Share on WhatsApp')).toHaveAttribute(
                'href',
                `https://wa.me/?text=${encodeURIComponent(expected)}`
            );
        });

        it('should build correct Facebook sharer URL', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on Facebook')).toHaveAttribute(
                'href',
                `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(defaultProps.url)}`
            );
        });

        it('should build correct Twitter intent URL with text', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            const tweetText = `${defaultProps.title} - ${defaultProps.text}`;
            expect(screen.getByLabelText('Share on Twitter')).toHaveAttribute(
                'href',
                `https://twitter.com/intent/tweet?url=${encodeURIComponent(defaultProps.url)}&text=${encodeURIComponent(tweetText)}`
            );
        });

        it('should build correct Twitter intent URL without text', () => {
            render(
                <ShareButtons
                    url={defaultProps.url}
                    title={defaultProps.title}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on Twitter')).toHaveAttribute(
                'href',
                `https://twitter.com/intent/tweet?url=${encodeURIComponent(defaultProps.url)}&text=${encodeURIComponent(defaultProps.title)}`
            );
        });
    });

    describe('Social link attributes', () => {
        beforeEach(() => {
            Object.defineProperty(navigator, 'share', {
                value: undefined,
                configurable: true
            });
        });

        it('should have target="_blank" on all social links', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on WhatsApp')).toHaveAttribute('target', '_blank');
            expect(screen.getByLabelText('Share on Facebook')).toHaveAttribute('target', '_blank');
            expect(screen.getByLabelText('Share on Twitter')).toHaveAttribute('target', '_blank');
        });

        it('should have rel="noopener noreferrer" on all social links', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on WhatsApp')).toHaveAttribute(
                'rel',
                'noopener noreferrer'
            );
            expect(screen.getByLabelText('Share on Facebook')).toHaveAttribute(
                'rel',
                'noopener noreferrer'
            );
            expect(screen.getByLabelText('Share on Twitter')).toHaveAttribute(
                'rel',
                'noopener noreferrer'
            );
        });
    });

    describe('Copy to clipboard', () => {
        beforeEach(() => {
            Object.defineProperty(navigator, 'share', {
                value: undefined,
                configurable: true
            });
            Object.defineProperty(navigator, 'clipboard', {
                writable: true,
                configurable: true,
                value: { writeText: vi.fn().mockResolvedValue(undefined) }
            });
        });

        it('should call clipboard.writeText with the url when copy button is clicked', async () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByLabelText('Copy link to clipboard'));
            await waitFor(() => {
                expect(navigator.clipboard.writeText).toHaveBeenCalledWith(defaultProps.url);
            });
        });

        it('should show copied confirmation text after copying', async () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByLabelText('Copy link to clipboard'));
            await waitFor(() => {
                // The component uses t('share.copied', 'Copiado!') - mock returns fallback
                expect(screen.getByText('Copiado!')).toBeInTheDocument();
            });
        });

        it('should update aria-label to "Link copied" state after copying', async () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByLabelText('Copy link to clipboard'));
            await waitFor(() => {
                expect(screen.getByLabelText('Link copied')).toBeInTheDocument();
            });
        });

        it('should reset copied state after 2 seconds', async () => {
            vi.useFakeTimers();
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );

            await act(async () => {
                fireEvent.click(screen.getByLabelText('Copy link to clipboard'));
            });

            expect(screen.getByText('Copiado!')).toBeInTheDocument();

            await act(async () => {
                vi.advanceTimersByTime(2000);
            });

            expect(screen.queryByText('Copiado!')).not.toBeInTheDocument();
            vi.useRealTimers();
        });

        it('should log error and not crash when clipboard fails', async () => {
            const failingClipboard = {
                writeText: vi.fn().mockRejectedValue(new Error('Permission denied'))
            };
            Object.defineProperty(navigator, 'clipboard', {
                writable: true,
                configurable: true,
                value: failingClipboard
            });

            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            fireEvent.click(screen.getByLabelText('Copy link to clipboard'));

            await vi.waitFor(() => {
                expect(failingClipboard.writeText).toHaveBeenCalled();
            });

            await vi.waitFor(
                () => {
                    expect(webLoggerErrorMock).toHaveBeenCalledWith(
                        'Clipboard copy failed:',
                        expect.any(Error)
                    );
                },
                { timeout: 100 }
            );
        });
    });

    describe('Web Share API invocation', () => {
        beforeEach(() => {
            Object.defineProperty(navigator, 'share', {
                writable: true,
                configurable: true,
                value: vi.fn().mockResolvedValue(undefined)
            });
        });

        it('should call navigator.share with url, title, and text when share button is clicked', async () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Share via device'));
            });
            expect(navigator.share).toHaveBeenCalledWith({
                url: defaultProps.url,
                title: defaultProps.title,
                text: defaultProps.text
            });
        });

        it('should call navigator.share with empty string text when text is omitted', async () => {
            render(
                <ShareButtons
                    url={defaultProps.url}
                    title={defaultProps.title}
                    locale="en"
                />
            );
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Share via device'));
            });
            expect(navigator.share).toHaveBeenCalledWith({
                url: defaultProps.url,
                title: defaultProps.title,
                text: ''
            });
        });

        it('should log non-AbortError failures silently', async () => {
            const shareMock = vi.fn().mockRejectedValue(new Error('Unknown share error'));
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
            fireEvent.click(screen.getByLabelText('Share via device'));

            await vi.waitFor(() => expect(shareMock).toHaveBeenCalled());
            await vi.waitFor(
                () => {
                    expect(webLoggerErrorMock).toHaveBeenCalledWith(
                        'Native share failed:',
                        expect.any(Error)
                    );
                },
                { timeout: 100 }
            );
        });
    });

    describe('Accessibility', () => {
        beforeEach(() => {
            Object.defineProperty(navigator, 'share', {
                value: undefined,
                configurable: true
            });
        });

        it('should have aria-label on all social buttons', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on WhatsApp')).toBeInTheDocument();
            expect(screen.getByLabelText('Share on Facebook')).toBeInTheDocument();
            expect(screen.getByLabelText('Share on Twitter')).toBeInTheDocument();
            expect(screen.getByLabelText('Copy link to clipboard')).toBeInTheDocument();
        });

        it('should have type="button" on the copy button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Copy link to clipboard')).toHaveAttribute(
                'type',
                'button'
            );
        });

        it('should have aria-live="polite" on the copied confirmation text', async () => {
            Object.defineProperty(navigator, 'clipboard', {
                writable: true,
                configurable: true,
                value: { writeText: vi.fn().mockResolvedValue(undefined) }
            });

            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            await act(async () => {
                fireEvent.click(screen.getByLabelText('Copy link to clipboard'));
            });

            await vi.waitFor(
                () => {
                    const feedback = screen.getByText('Copiado!');
                    expect(feedback).toHaveAttribute('aria-live', 'polite');
                },
                { timeout: 100 }
            );
        });

        it('should have focus-visible styles on the copy button', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Copy link to clipboard').className).toContain(
                'focus-visible:outline'
            );
        });

        it('should have rounded-full style on social icon buttons', () => {
            render(
                <ShareButtons
                    {...defaultProps}
                    locale="en"
                />
            );
            expect(screen.getByLabelText('Share on WhatsApp').className).toContain('rounded-full');
        });
    });
});
