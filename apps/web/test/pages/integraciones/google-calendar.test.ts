import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pageSrc = readFileSync(
    resolve(__dirname, '../../../src/pages/[lang]/integraciones/google-calendar/index.astro'),
    'utf8'
);

const localeSrc = readFileSync(
    resolve(__dirname, '../../../../../packages/i18n/src/locales/es/google-calendar.json'),
    'utf8'
);

const featuresSrc = readFileSync(
    resolve(__dirname, '../../../src/lib/features-content.ts'),
    'utf8'
);

describe('Google Calendar public integration page', () => {
    it('should use the shared marketing layout', () => {
        expect(pageSrc).toContain('MarketingLayout');
        expect(pageSrc).toContain('canonicalPath={`/${locale}/integraciones/google-calendar/`}');
    });

    it('should expose the readonly Google Calendar scope on the public page', () => {
        expect(pageSrc).toContain("key: 'scope'");
        expect(localeSrc).toContain('https://www.googleapis.com/auth/calendar.readonly');
    });

    it('should link to the privacy policy and contact page', () => {
        expect(pageSrc).toContain("path: '/legal/privacidad/'");
        expect(pageSrc).toContain("path: '/contacto/'");
    });

    it('should describe prohibited data uses on the public page', () => {
        expect(pageSrc).toContain("key: 'limitedUse'");
        expect(localeSrc).toContain(
            'No creamos, editamos ni eliminamos eventos en Google Calendar'
        );
        expect(localeSrc).toContain(
            'No usamos estos datos para publicidad, venta a terceros ni entrenamiento de IA'
        );
    });

    it('should stop advertising calendar sync as a coming-soon feature', () => {
        expect(featuresSrc).toContain('features.anfitriones.list.calendarSync.title');
        expect(featuresSrc).not.toContain('features.proximamente.items.calendarSync.title');
    });
});
