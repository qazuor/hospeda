import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const srcDir = resolve(__dirname, '../../src');

const src = readFileSync(resolve(srcDir, 'layouts/Footer.astro'), 'utf8');

describe('Footer.astro - Semantic HTML', () => {
    it('should use a footer element as the root element', () => {
        // Arrange: source already loaded
        // Act: look for semantic footer element
        // Assert
        expect(src).toContain('<footer');
    });

    it('should close the footer element correctly', () => {
        // Arrange / Act / Assert
        expect(src).toContain('</footer>');
    });
});

describe('Footer.astro - Brand section', () => {
    it('should display the Hospeda brand name', () => {
        // Arrange / Act / Assert
        expect(src).toContain('Hospeda');
    });

    it('should import LocationIcon for the brand area', () => {
        // Arrange / Act / Assert
        expect(src).toContain('LocationIcon');
    });

    it('should render a brand tagline referencing Entre Rios and Rio Uruguay', () => {
        // Arrange / Act / Assert
        expect(src).toContain('footer.brand');
    });
});

describe('Footer.astro - Social media links', () => {
    it('should include an Instagram link with aria-label', () => {
        // Arrange / Act / Assert
        expect(src).toContain('aria-label="Instagram"');
        expect(src).toContain('InstagramIcon');
    });

    it('should include a Facebook link with aria-label', () => {
        // Arrange / Act / Assert
        expect(src).toContain('aria-label="Facebook"');
        expect(src).toContain('FacebookIcon');
    });

    it('should include a YouTube link with aria-label', () => {
        // Arrange / Act / Assert
        expect(src).toContain('aria-label="Youtube"');
        expect(src).toContain('YoutubeIcon');
    });

    it('should import all social icons from @repo/icons', () => {
        // Arrange / Act / Assert
        expect(src).toContain('@repo/icons');
        expect(src).toContain('InstagramIcon');
        expect(src).toContain('FacebookIcon');
        expect(src).toContain('YoutubeIcon');
    });
});

describe('Footer.astro - Navigation link columns', () => {
    it('should import FOOTER_LINKS from the navigation data file', () => {
        // Arrange / Act / Assert
        expect(src).toContain('FOOTER_LINKS');
        expect(src).toContain('@/data/navigation');
    });

    it('should iterate over FOOTER_LINKS to render link columns', () => {
        // Arrange / Act / Assert
        expect(src).toContain('Object.entries(FOOTER_LINKS)');
    });

    it('should build column link hrefs using buildUrl with the current locale', () => {
        // Arrange / Act / Assert
        expect(src).toContain('buildUrl({ locale: typedLocale');
    });

    it('should use column title translations from columnTitles record', () => {
        // Arrange / Act / Assert
        expect(src).toContain('columnTitles');
        expect(src).toContain('footer.columns.explorar');
        expect(src).toContain('footer.columns.destinos');
        expect(src).toContain('footer.columns.propietarios');
    });
});

describe('Footer.astro - Contact information', () => {
    it('should display an email address with EmailIcon', () => {
        // Arrange / Act / Assert
        expect(src).toContain('EmailIcon');
        expect(src).toContain('info@hospeda.com.ar');
    });

    it('should display a phone number with PhoneIcon', () => {
        // Arrange / Act / Assert
        expect(src).toContain('PhoneIcon');
        expect(src).toContain('+54 345 123-4567');
    });

    it('should import EmailIcon and PhoneIcon from @repo/icons', () => {
        // Arrange / Act / Assert
        expect(src).toContain('EmailIcon');
        expect(src).toContain('PhoneIcon');
    });
});

describe('Footer.astro - Copyright', () => {
    it('should include a copyright translation key', () => {
        // Arrange / Act / Assert
        expect(src).toContain('footer.copyright');
    });

    it('should mention the year 2026 in the copyright fallback text', () => {
        // Arrange / Act / Assert
        expect(src).toContain('2026');
    });

    it('should include rights reserved text in the copyright fallback', () => {
        // Arrange / Act / Assert
        expect(src).toContain('derechos reservados');
    });
});

describe('Footer.astro - Newsletter section', () => {
    it('should include a newsletter signup form', () => {
        // Arrange / Act / Assert
        expect(src).toContain('id="newsletter-form"');
        expect(src).toContain('<form');
    });

    it('should include an email input for newsletter subscription', () => {
        // Arrange / Act / Assert
        expect(src).toContain('type="email"');
        expect(src).toContain('id="newsletter-email"');
    });

    it('should mark the email input as required', () => {
        // Arrange / Act / Assert
        expect(src).toContain('required');
    });

    it('should include a submit button for the newsletter form', () => {
        // Arrange / Act / Assert
        expect(src).toContain('type="submit"');
        expect(src).toContain('footer.newsletter.submit');
    });

    it('should include a visually hidden label for the email input', () => {
        // Arrange / Act / Assert
        expect(src).toContain('class="sr-only"');
        expect(src).toContain('for="newsletter-email"');
    });

    it('should show a success message element after form submission', () => {
        // Arrange / Act / Assert
        expect(src).toContain('id="newsletter-success"');
        expect(src).toContain('footer.newsletter.success');
    });

    it('should import CheckCircleIcon for the success state', () => {
        // Arrange / Act / Assert
        expect(src).toContain('CheckCircleIcon');
    });

    it('should have newsletter heading and subtitle translation keys', () => {
        // Arrange / Act / Assert
        expect(src).toContain('footer.newsletter.title');
        expect(src).toContain('footer.newsletter.subtitle');
    });
});

describe('Footer.astro - Wave divider', () => {
    it('should import WaveDivider for the top wave transition', () => {
        // Arrange / Act / Assert
        expect(src).toContain('import WaveDivider from');
    });

    it('should render a WaveDivider component at the top of the footer', () => {
        // Arrange / Act / Assert
        expect(src).toContain('<WaveDivider');
    });

    it('should NOT contain an inline SVG for the wave (uses component instead)', () => {
        // Arrange / Act / Assert
        expect(src).not.toContain('<svg viewBox="0 0 1440 60"');
    });
});

describe('Footer.astro - Locale handling', () => {
    it('should accept a locale prop with default value of es', () => {
        // Arrange / Act / Assert
        expect(src).toContain("locale = 'es'");
    });

    it('should cast locale to SupportedLocale for type safety', () => {
        // Arrange / Act / Assert
        expect(src).toContain('SupportedLocale');
        expect(src).toContain('typedLocale');
    });

    it('should import createT from the i18n lib for translations', () => {
        // Arrange / Act / Assert
        expect(src).toContain('createT');
        expect(src).toContain('@/lib/i18n');
    });

    it('should import buildUrl from the urls lib for locale-aware hrefs', () => {
        // Arrange / Act / Assert
        expect(src).toContain('buildUrl');
        expect(src).toContain('@/lib/urls');
    });
});

describe('Footer.astro - Newsletter form script', () => {
    it('should contain a submit event listener that hides the form on success', () => {
        // Arrange / Act / Assert
        expect(src).toContain('addEventListener("submit"');
        expect(src).toContain('e.preventDefault()');
    });

    it('should show the success message by removing the hidden class', () => {
        // Arrange / Act / Assert
        expect(src).toContain('successMsg.classList.remove("hidden")');
        expect(src).toContain('successMsg.classList.add("flex")');
    });
});
