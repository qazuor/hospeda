/**
 * Accessibility Test Suite
 *
 * Comprehensive automated accessibility tests validating WCAG 2.1 AA compliance
 * across all key pages and components in the web2 application.
 *
 * Test Strategy:
 * - Astro components: Read source files and verify HTML structure and ARIA attributes
 * - React components: Similar file-based verification for accessibility patterns
 * - Manual validation pattern (no axe-core required - not in dependencies)
 *
 * Coverage areas:
 * 1. ARIA Landmarks and Semantic HTML
 * 2. Heading Hierarchy
 * 3. Form Accessibility
 * 4. Interactive Component Accessibility
 * 5. Image Accessibility
 * 6. Navigation Accessibility
 * 7. Focus Management
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../src');

/**
 * Helper to read component file
 */
function readComponent(relativePath: string): string {
    return readFileSync(resolve(srcDir, relativePath), 'utf8');
}

/**
 * Helper to read page file
 */
function readPage(relativePath: string): string {
    return readFileSync(resolve(srcDir, relativePath), 'utf8');
}

/**
 * Helper to read layout file
 */
function readLayout(relativePath: string): string {
    return readFileSync(resolve(srcDir, relativePath), 'utf8');
}

describe('Accessibility Tests', () => {
    describe('ARIA Landmarks and Semantic HTML', () => {
        describe('BaseLayout', () => {
            let baseLayoutContent: string;

            beforeAll(() => {
                baseLayoutContent = readLayout('layouts/BaseLayout.astro');
            });

            it('should have main landmark with id', () => {
                expect(baseLayoutContent).toContain('<main id="main-content">');
            });

            it('should have skip to content link', () => {
                expect(baseLayoutContent).toContain('href="#main-content"');
                expect(baseLayoutContent).toContain('Skip to content');
            });

            it('should have skip link with focus-visible styles', () => {
                expect(baseLayoutContent).toContain('sr-only focus:not-sr-only');
                expect(baseLayoutContent).toContain('focus:fixed');
            });

            it('should have html lang attribute', () => {
                expect(baseLayoutContent).toContain('<html lang={locale}');
            });

            it('should have charset UTF-8', () => {
                expect(baseLayoutContent).toContain('<meta charset="UTF-8"');
            });

            it('should have viewport meta tag', () => {
                expect(baseLayoutContent).toContain('<meta name="viewport"');
                expect(baseLayoutContent).toContain('width=device-width');
            });

            it('should import and render Header and Footer components', () => {
                expect(baseLayoutContent).toContain("import Header from './Header.astro'");
                expect(baseLayoutContent).toContain("import Footer from './Footer.astro'");
                expect(baseLayoutContent).toContain('<Header locale={locale}');
                expect(baseLayoutContent).toContain('<Footer locale={locale}');
            });
        });

        describe('Header', () => {
            let headerContent: string;

            beforeAll(() => {
                headerContent = readLayout('layouts/Header.astro');
            });

            it('should have header with role="banner"', () => {
                expect(headerContent).toContain('<header role="banner"');
            });

            it('should have navigation with role="navigation"', () => {
                expect(headerContent).toContain('<nav role="navigation"');
            });

            it('should have aria-label on navigation', () => {
                expect(headerContent).toContain('aria-label="Main navigation"');
            });

            it('should have mobile menu button with aria-label', () => {
                expect(headerContent).toContain('aria-label="Open menu"');
            });

            it('should have decorative icons with aria-hidden', () => {
                expect(headerContent).toContain('aria-hidden="true"');
            });
        });

        describe('Footer', () => {
            let footerContent: string;

            beforeAll(() => {
                footerContent = readLayout('layouts/Footer.astro');
            });

            it('should have footer with role="contentinfo"', () => {
                expect(footerContent).toContain('<footer role="contentinfo"');
            });

            it('should have heading for link groups', () => {
                expect(footerContent).toContain('<h3');
            });

            it('should use semantic list elements for navigation', () => {
                expect(footerContent).toContain('<ul');
                expect(footerContent).toContain('<li>');
            });
        });
    });

    describe('Heading Hierarchy', () => {
        describe('Homepage', () => {
            let homepageContent: string;

            beforeAll(() => {
                homepageContent = readPage('pages/[lang]/index.astro');
            });

            it('should use BaseLayout which provides document structure', () => {
                expect(homepageContent).toContain('import BaseLayout');
                expect(homepageContent).toContain('<BaseLayout');
            });

            it('should pass title prop to BaseLayout', () => {
                expect(homepageContent).toContain('title={t.pageTitle}');
            });

            it('should pass description prop to BaseLayout', () => {
                expect(homepageContent).toContain('description={t.pageDescription}');
            });
        });

        describe('Accommodation Detail Page', () => {
            let accommodationContent: string;

            beforeAll(() => {
                accommodationContent = readPage('pages/[lang]/alojamientos/[slug].astro');
            });

            it('should have h1 for accommodation name', () => {
                expect(accommodationContent).toContain('<h1');
                expect(accommodationContent).toContain('.name}');
            });

            it('should have h2 for major sections', () => {
                expect(accommodationContent).toContain('<h2');
                expect(accommodationContent).toContain('{t.description}');
                expect(accommodationContent).toContain('{t.amenities}');
                expect(accommodationContent).toContain('{t.location}');
                expect(accommodationContent).toContain('{t.reviews}');
                expect(accommodationContent).toContain('{t.faq}');
            });

            it('should use section elements for major content areas', () => {
                expect(accommodationContent).toContain('<section>');
            });

            it('should use aside element for sidebar', () => {
                expect(accommodationContent).toContain('<aside');
            });
        });
    });

    describe('Form Accessibility', () => {
        describe('Input Component', () => {
            let inputContent: string;

            beforeAll(() => {
                inputContent = readComponent('components/ui/Input.astro');
            });

            it('should have label element', () => {
                expect(inputContent).toContain('<label');
            });

            it('should have label for attribute linking to input id', () => {
                expect(inputContent).toContain('for={inputId}');
            });

            it('should generate unique id for input', () => {
                expect(inputContent).toContain('const inputId = id || `input-${name}`');
            });

            it('should support required attribute', () => {
                expect(inputContent).toContain('required?: boolean');
                expect(inputContent).toContain('required={required || undefined}');
            });

            it('should have aria-invalid for error state', () => {
                expect(inputContent).toContain("aria-invalid={error ? 'true' : undefined}");
            });

            it('should have aria-describedby linking to error message', () => {
                expect(inputContent).toContain('aria-describedby={error ? errorId : undefined}');
            });

            it('should have error message with role="alert"', () => {
                expect(inputContent).toContain('role="alert"');
            });

            it('should visually indicate required fields', () => {
                expect(inputContent).toContain('aria-label="required"');
            });

            it('should have focus styles', () => {
                expect(inputContent).toContain('focus:outline-none');
                expect(inputContent).toContain('focus:ring-2');
                expect(inputContent).toContain('focus:ring-primary');
            });

            it('should support disabled state', () => {
                expect(inputContent).toContain('disabled?: boolean');
                expect(inputContent).toContain('disabled={disabled}');
                expect(inputContent).toContain('disabled:opacity-50');
                expect(inputContent).toContain('disabled:cursor-not-allowed');
            });
        });

        describe('Button Component', () => {
            let buttonContent: string;

            beforeAll(() => {
                buttonContent = readComponent('components/ui/Button.astro');
            });

            it('should have focus-visible styles', () => {
                expect(buttonContent).toContain('focus-visible:outline');
            });

            it('should support aria-disabled for links', () => {
                expect(buttonContent).toContain('aria-disabled');
            });

            it('should support aria-busy for loading state', () => {
                expect(buttonContent).toContain('aria-busy');
            });

            it('should disable interactions when disabled', () => {
                expect(buttonContent).toContain('disabled:pointer-events-none');
                expect(buttonContent).toContain('disabled:opacity-50');
            });

            it('should hide loading spinner from screen readers', () => {
                expect(buttonContent).toContain('aria-hidden="true"');
            });
        });
    });

    describe('Interactive Component Accessibility', () => {
        describe('Modal Component', () => {
            let modalContent: string;

            beforeAll(() => {
                modalContent = readComponent('components/ui/Modal.client.tsx');
            });

            it('should use native dialog element', () => {
                expect(modalContent).toContain('<dialog');
            });

            it('should have aria-modal attribute', () => {
                expect(modalContent).toContain('aria-modal="true"');
            });

            it('should have aria-labelledby linking to title', () => {
                expect(modalContent).toContain('aria-labelledby="modal-title"');
            });

            it('should have id on title element', () => {
                expect(modalContent).toContain('id="modal-title"');
            });

            it('should have close button with aria-label', () => {
                expect(modalContent).toContain('aria-label="Close modal"');
            });

            it('should have focus-visible styles on close button', () => {
                expect(modalContent).toContain('focus-visible:outline');
            });

            it('should handle Escape key', () => {
                expect(modalContent).toContain("e.key === 'Escape'");
            });

            it('should hide decorative close icon from screen readers', () => {
                expect(modalContent).toContain('aria-hidden="true"');
            });
        });

        describe('Tabs Component', () => {
            let tabsContent: string;

            beforeAll(() => {
                tabsContent = readComponent('components/ui/Tabs.client.tsx');
            });

            it('should have role="tablist" on tab container', () => {
                expect(tabsContent).toContain('role="tablist"');
            });

            it('should have role="tab" on tab buttons', () => {
                expect(tabsContent).toContain('role="tab"');
            });

            it('should have role="tabpanel" on panels', () => {
                expect(tabsContent).toContain('role="tabpanel"');
            });

            it('should have aria-selected on tabs', () => {
                expect(tabsContent).toContain('aria-selected={isActive}');
            });

            it('should have aria-controls linking tab to panel', () => {
                expect(tabsContent).toContain('aria-controls={`panel-${tab.id}`}');
            });

            it('should have aria-labelledby linking panel to tab', () => {
                expect(tabsContent).toContain('aria-labelledby={`tab-${tab.id}`}');
            });

            it('should manage tabIndex for roving tabindex pattern', () => {
                expect(tabsContent).toContain('tabIndex={isActive ? 0 : -1}');
            });

            it('should support ArrowLeft navigation', () => {
                expect(tabsContent).toContain("case 'ArrowLeft'");
            });

            it('should support ArrowRight navigation', () => {
                expect(tabsContent).toContain("case 'ArrowRight'");
            });

            it('should support Home key navigation', () => {
                expect(tabsContent).toContain("case 'Home'");
            });

            it('should support End key navigation', () => {
                expect(tabsContent).toContain("case 'End'");
            });

            it('should have focus-visible styles', () => {
                expect(tabsContent).toContain('focus-visible:outline');
            });

            it('should have type="button" on tab buttons', () => {
                expect(tabsContent).toContain('type="button"');
            });
        });

        describe('AccordionFAQ Component', () => {
            let accordionContent: string;

            beforeAll(() => {
                accordionContent = readComponent('components/ui/AccordionFAQ.client.tsx');
            });

            it('should use native details element', () => {
                expect(accordionContent).toContain('<details');
            });

            it('should use native summary element', () => {
                expect(accordionContent).toContain('<summary');
            });

            it('should have aria-expanded on summary', () => {
                expect(accordionContent).toContain('aria-expanded=');
            });

            it('should have aria-controls linking summary to content', () => {
                expect(accordionContent).toContain('aria-controls={contentId}');
            });

            it('should use section element for content', () => {
                expect(accordionContent).toContain('<section');
            });

            it('should have aria-labelledby on content', () => {
                expect(accordionContent).toContain('aria-labelledby={itemId}');
            });

            it('should have focus-visible styles on summary', () => {
                expect(accordionContent).toContain('focus-visible:outline');
            });

            it('should hide decorative icon from screen readers', () => {
                expect(accordionContent).toContain('aria-hidden="true"');
            });

            it('should use section element with aria-label on container', () => {
                expect(accordionContent).toContain('<section');
                expect(accordionContent).toContain('aria-label="Frequently Asked Questions"');
            });
        });

        describe('ShareButtons Component', () => {
            let shareButtonsContent: string;

            beforeAll(() => {
                shareButtonsContent = readComponent('components/ui/ShareButtons.client.tsx');
            });

            it('should have aria-label on native share button', () => {
                expect(shareButtonsContent).toContain('aria-label="Share via device"');
            });

            it('should have aria-label on WhatsApp button', () => {
                expect(shareButtonsContent).toContain('aria-label="Share on WhatsApp"');
            });

            it('should have aria-label on Facebook button', () => {
                expect(shareButtonsContent).toContain('aria-label="Share on Facebook"');
            });

            it('should have aria-label on Twitter button', () => {
                expect(shareButtonsContent).toContain('aria-label="Share on Twitter"');
            });

            it('should have dynamic aria-label on copy button', () => {
                expect(shareButtonsContent).toContain(
                    "aria-label={copied ? 'Link copied' : 'Copy link to clipboard'}"
                );
            });

            it('should hide decorative icons from screen readers', () => {
                expect(shareButtonsContent).toContain('aria-hidden="true"');
            });

            it('should have focus-visible styles', () => {
                expect(shareButtonsContent).toContain('focus-visible:outline');
            });

            it('should have aria-live region for copy feedback', () => {
                expect(shareButtonsContent).toContain('aria-live="polite"');
            });

            it('should have type="button" on buttons', () => {
                expect(shareButtonsContent).toContain('type="button"');
            });
        });
    });

    describe('Image Accessibility', () => {
        describe('OptimizedImage Component', () => {
            let optimizedImageContent: string;

            beforeAll(() => {
                optimizedImageContent = readComponent('components/ui/OptimizedImage.astro');
            });

            it('should require alt prop', () => {
                expect(optimizedImageContent).toContain('alt: string');
            });

            it('should have alt attribute on img element', () => {
                expect(optimizedImageContent).toContain('alt={alt}');
            });

            it('should support lazy loading', () => {
                expect(optimizedImageContent).toContain("loading?: 'lazy' | 'eager'");
                expect(optimizedImageContent).toContain("loading = 'lazy'");
                expect(optimizedImageContent).toContain('loading={loading}');
            });

            it('should have width and height for CLS prevention', () => {
                expect(optimizedImageContent).toContain('width: number');
                expect(optimizedImageContent).toContain('height: number');
                expect(optimizedImageContent).toContain('width={width}');
                expect(optimizedImageContent).toContain('height={height}');
            });

            it('should support async decoding', () => {
                expect(optimizedImageContent).toContain("decoding = 'async'");
            });

            it('should have responsive sizes attribute', () => {
                expect(optimizedImageContent).toContain('sizes?: string');
                expect(optimizedImageContent).toContain('sizes={sizes}');
            });

            it('should generate srcset for responsive images', () => {
                expect(optimizedImageContent).toContain('srcset');
            });
        });
    });

    describe('Navigation Accessibility', () => {
        describe('Breadcrumb Component', () => {
            let breadcrumbContent: string;

            beforeAll(() => {
                breadcrumbContent = readComponent('components/ui/Breadcrumb.astro');
            });

            it('should have nav element with aria-label', () => {
                expect(breadcrumbContent).toContain('<nav aria-label="Breadcrumb"');
            });

            it('should use ordered list for breadcrumb items', () => {
                expect(breadcrumbContent).toContain('<ol');
            });

            it('should use list items for each breadcrumb', () => {
                expect(breadcrumbContent).toContain('<li');
            });

            it('should have aria-current="page" on last item', () => {
                expect(breadcrumbContent).toContain('aria-current="page"');
            });

            it('should hide separator from screen readers', () => {
                expect(breadcrumbContent).toContain('aria-hidden="true"');
            });

            it('should include JSON-LD structured data', () => {
                expect(breadcrumbContent).toContain('type="application/ld+json"');
                expect(breadcrumbContent).toContain('BreadcrumbList');
            });
        });
    });

    describe('Focus Management', () => {
        describe('Skip to Content Link', () => {
            let baseLayoutContent: string;

            beforeAll(() => {
                baseLayoutContent = readLayout('layouts/BaseLayout.astro');
            });

            it('should be hidden by default', () => {
                expect(baseLayoutContent).toContain('sr-only');
            });

            it('should be visible on focus', () => {
                expect(baseLayoutContent).toContain('focus:not-sr-only');
            });

            it('should be positioned accessibly when focused', () => {
                expect(baseLayoutContent).toContain('focus:fixed');
                expect(baseLayoutContent).toContain('focus:top-4');
                expect(baseLayoutContent).toContain('focus:left-4');
            });

            it('should have high z-index when focused', () => {
                expect(baseLayoutContent).toContain('focus:z-50');
            });

            it('should have clear styling when focused', () => {
                expect(baseLayoutContent).toContain('focus:bg-primary');
                expect(baseLayoutContent).toContain('focus:text-white');
                expect(baseLayoutContent).toContain('focus:px-4');
                expect(baseLayoutContent).toContain('focus:py-2');
            });
        });

        describe('Focus Visible Styles', () => {
            it('should have focus-visible on Button', () => {
                const buttonContent = readComponent('components/ui/Button.astro');
                expect(buttonContent).toContain('focus-visible:outline');
            });

            it('should have focus-visible on Input', () => {
                const inputContent = readComponent('components/ui/Input.astro');
                expect(inputContent).toContain('focus:ring-2');
                expect(inputContent).toContain('focus:ring-primary');
            });

            it('should have focus-visible on Tabs', () => {
                const tabsContent = readComponent('components/ui/Tabs.client.tsx');
                expect(tabsContent).toContain('focus-visible:outline');
            });

            it('should have focus-visible on Modal close button', () => {
                const modalContent = readComponent('components/ui/Modal.client.tsx');
                expect(modalContent).toContain('focus-visible:outline');
            });

            it('should have focus-visible on AccordionFAQ', () => {
                const accordionContent = readComponent('components/ui/AccordionFAQ.client.tsx');
                expect(accordionContent).toContain('focus-visible:outline');
            });

            it('should have focus-visible on ShareButtons', () => {
                const shareButtonsContent = readComponent('components/ui/ShareButtons.client.tsx');
                expect(shareButtonsContent).toContain('focus-visible:outline');
            });
        });
    });

    describe('Color and Contrast', () => {
        describe('Button Component', () => {
            let buttonContent: string;

            beforeAll(() => {
                buttonContent = readComponent('components/ui/Button.astro');
            });

            it('should have high contrast primary variant', () => {
                expect(buttonContent).toContain('bg-primary');
                expect(buttonContent).toContain('text-white');
            });

            it('should have visible outline variant', () => {
                expect(buttonContent).toContain('border-primary');
                expect(buttonContent).toContain('text-primary');
            });

            it('should reduce opacity for disabled state', () => {
                expect(buttonContent).toContain('disabled:opacity-50');
            });
        });
    });

    describe('Keyboard Navigation', () => {
        describe('Tabs Component', () => {
            let tabsContent: string;

            beforeAll(() => {
                tabsContent = readComponent('components/ui/Tabs.client.tsx');
            });

            it('should handle keyboard navigation function', () => {
                expect(tabsContent).toContain('handleKeyDown');
            });

            it('should prevent default for arrow keys', () => {
                expect(tabsContent).toContain('event.preventDefault()');
            });

            it('should wrap navigation at boundaries', () => {
                expect(tabsContent).toContain('tabs.length - 1');
            });
        });

        describe('Modal Component', () => {
            let modalContent: string;

            beforeAll(() => {
                modalContent = readComponent('components/ui/Modal.client.tsx');
            });

            it('should handle Escape key to close', () => {
                expect(modalContent).toContain('onKeyDown');
                expect(modalContent).toContain("key === 'Escape'");
            });

            it('should listen to cancel event', () => {
                expect(modalContent).toContain("addEventListener('cancel'");
            });
        });
    });

    describe('State Communication', () => {
        describe('Input Error States', () => {
            let inputContent: string;

            beforeAll(() => {
                inputContent = readComponent('components/ui/Input.astro');
            });

            it('should communicate errors with aria-invalid', () => {
                expect(inputContent).toContain('aria-invalid');
            });

            it('should link errors with aria-describedby', () => {
                expect(inputContent).toContain('aria-describedby');
            });

            it('should announce errors with role="alert"', () => {
                expect(inputContent).toContain('role="alert"');
            });

            it('should visually distinguish error state', () => {
                expect(inputContent).toContain('border-red-500');
                expect(inputContent).toContain('text-red-500');
            });
        });

        describe('Button Loading States', () => {
            let buttonContent: string;

            beforeAll(() => {
                buttonContent = readComponent('components/ui/Button.astro');
            });

            it('should communicate loading with aria-busy', () => {
                expect(buttonContent).toContain('aria-busy');
            });

            it('should disable interaction when loading', () => {
                expect(buttonContent).toContain('disabled={disabled || loading}');
            });
        });

        describe('ShareButtons Copy Feedback', () => {
            let shareButtonsContent: string;

            beforeAll(() => {
                shareButtonsContent = readComponent('components/ui/ShareButtons.client.tsx');
            });

            it('should announce copy success with aria-live', () => {
                expect(shareButtonsContent).toContain('aria-live="polite"');
            });

            it('should show visual feedback for copy state', () => {
                expect(shareButtonsContent).toContain('Copied!');
            });

            it('should update aria-label for copy state', () => {
                expect(shareButtonsContent).toContain('Link copied');
            });
        });
    });

    describe('Semantic HTML Structure', () => {
        describe('Header Component', () => {
            let headerContent: string;

            beforeAll(() => {
                headerContent = readLayout('layouts/Header.astro');
            });

            it('should use header element', () => {
                expect(headerContent).toContain('<header');
            });

            it('should use nav element', () => {
                expect(headerContent).toContain('<nav');
            });

            it('should use button element for menu trigger', () => {
                expect(headerContent).toContain('<button');
                expect(headerContent).toContain('type="button"');
            });
        });

        describe('Footer Component', () => {
            let footerContent: string;

            beforeAll(() => {
                footerContent = readLayout('layouts/Footer.astro');
            });

            it('should use footer element', () => {
                expect(footerContent).toContain('<footer');
            });

            it('should use lists for navigation groups', () => {
                expect(footerContent).toContain('<ul');
                expect(footerContent).toContain('<li>');
            });

            it('should use headings for group titles', () => {
                expect(footerContent).toContain('<h3');
            });
        });

        describe('Accommodation Detail Page', () => {
            let accommodationContent: string;

            beforeAll(() => {
                accommodationContent = readPage('pages/[lang]/alojamientos/[slug].astro');
            });

            it('should use section elements', () => {
                expect(accommodationContent).toContain('<section>');
            });

            it('should use aside for sidebar', () => {
                expect(accommodationContent).toContain('<aside');
            });

            it('should use heading hierarchy', () => {
                expect(accommodationContent).toContain('<h1');
                expect(accommodationContent).toContain('<h2');
            });
        });
    });

    describe('Screen Reader Support', () => {
        describe('Decorative Elements', () => {
            it('should hide decorative icons in Header', () => {
                const headerContent = readLayout('layouts/Header.astro');
                expect(headerContent).toContain('aria-hidden="true"');
            });

            it('should hide decorative separators in Breadcrumb', () => {
                const breadcrumbContent = readComponent('components/ui/Breadcrumb.astro');
                expect(breadcrumbContent).toContain('aria-hidden="true"');
            });

            it('should hide decorative icons in ShareButtons', () => {
                const shareButtonsContent = readComponent('components/ui/ShareButtons.client.tsx');
                expect(shareButtonsContent).toContain('aria-hidden="true"');
            });

            it('should hide loading spinner in Button', () => {
                const buttonContent = readComponent('components/ui/Button.astro');
                expect(buttonContent).toContain('aria-hidden="true"');
            });
        });

        describe('Screen Reader Only Content', () => {
            it('should have sr-only class for skip link', () => {
                const baseLayoutContent = readLayout('layouts/BaseLayout.astro');
                expect(baseLayoutContent).toContain('sr-only');
            });

            it('should have sr-only label for required indicator', () => {
                const inputContent = readComponent('components/ui/Input.astro');
                expect(inputContent).toContain('aria-label="required"');
            });
        });
    });

    describe('Interactive State Indicators', () => {
        describe('Accordion Component', () => {
            let accordionContent: string;

            beforeAll(() => {
                accordionContent = readComponent('components/ui/AccordionFAQ.client.tsx');
            });

            it('should indicate expanded state with aria-expanded', () => {
                expect(accordionContent).toContain('aria-expanded');
            });

            it('should use open attribute for details element', () => {
                expect(accordionContent).toContain('open={isOpen}');
            });

            it('should visually indicate expanded state', () => {
                expect(accordionContent).toContain('rotate-180');
            });
        });

        describe('Tabs Component', () => {
            let tabsContent: string;

            beforeAll(() => {
                tabsContent = readComponent('components/ui/Tabs.client.tsx');
            });

            it('should indicate selected state with aria-selected', () => {
                expect(tabsContent).toContain('aria-selected');
            });

            it('should hide inactive panels', () => {
                expect(tabsContent).toContain('hidden={!isActive}');
            });

            it('should visually distinguish active tab', () => {
                expect(tabsContent).toContain('border-primary');
                expect(tabsContent).toContain('text-primary');
            });
        });
    });

    describe('Form Control Association', () => {
        describe('Input Component', () => {
            let inputContent: string;

            beforeAll(() => {
                inputContent = readComponent('components/ui/Input.astro');
            });

            it('should associate label with input via for/id', () => {
                expect(inputContent).toContain('for={inputId}');
                expect(inputContent).toContain('id={inputId}');
            });

            it('should generate unique IDs', () => {
                expect(inputContent).toContain('inputId');
                expect(inputContent).toContain('errorId');
            });

            it('should link error messages with aria-describedby', () => {
                expect(inputContent).toContain('aria-describedby={error ? errorId : undefined}');
                expect(inputContent).toContain('id={errorId}');
            });
        });
    });

    describe('Link Accessibility', () => {
        describe('Breadcrumb Links', () => {
            let breadcrumbContent: string;

            beforeAll(() => {
                breadcrumbContent = readComponent('components/ui/Breadcrumb.astro');
            });

            it('should render current page as text not link', () => {
                expect(breadcrumbContent).toContain('isLast');
                expect(breadcrumbContent).toContain('<span');
            });

            it('should use anchor elements for navigable items', () => {
                expect(breadcrumbContent).toContain('<a');
                expect(breadcrumbContent).toContain('href={item.href}');
            });

            it('should have hover styles for links', () => {
                expect(breadcrumbContent).toContain('hover:text-primary');
            });
        });

        describe('ShareButtons Links', () => {
            let shareButtonsContent: string;

            beforeAll(() => {
                shareButtonsContent = readComponent('components/ui/ShareButtons.client.tsx');
            });

            it('should have rel="noopener noreferrer" on external links', () => {
                expect(shareButtonsContent).toContain('rel="noopener noreferrer"');
            });

            it('should open external links in new tab', () => {
                expect(shareButtonsContent).toContain('target="_blank"');
            });

            it('should have descriptive aria-labels', () => {
                expect(shareButtonsContent).toContain('aria-label="Share on');
            });
        });
    });

    describe('Responsive Accessibility', () => {
        describe('Header Navigation', () => {
            let headerContent: string;

            beforeAll(() => {
                headerContent = readLayout('layouts/Header.astro');
            });

            it('should hide desktop nav on mobile', () => {
                expect(headerContent).toContain('hidden');
                expect(headerContent).toContain('md:flex');
            });

            it('should show mobile menu button on small screens', () => {
                expect(headerContent).toContain('md:hidden');
            });
        });
    });

    describe('Progressive Enhancement', () => {
        describe('AccordionFAQ Component', () => {
            let accordionContent: string;

            beforeAll(() => {
                accordionContent = readComponent('components/ui/AccordionFAQ.client.tsx');
            });

            it('should use native details/summary elements', () => {
                expect(accordionContent).toContain('<details');
                expect(accordionContent).toContain('<summary');
            });

            it('should work without JavaScript via details element', () => {
                expect(accordionContent).toContain('open={isOpen}');
            });
        });

        describe('Modal Component', () => {
            let modalContent: string;

            beforeAll(() => {
                modalContent = readComponent('components/ui/Modal.client.tsx');
            });

            it('should use native dialog element', () => {
                expect(modalContent).toContain('<dialog');
                expect(modalContent).toContain('dialogRef');
            });

            it('should use native showModal() API', () => {
                expect(modalContent).toContain('showModal()');
            });
        });
    });
});
