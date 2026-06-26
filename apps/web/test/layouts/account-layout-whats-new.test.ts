import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const accountLayoutSource = readFileSync(
    resolve(__dirname, '../../src/layouts/AccountLayout.astro'),
    'utf8'
);

const dashboardSource = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/index.astro'),
    'utf8'
);

const preferencesSource = readFileSync(
    resolve(__dirname, '../../src/pages/[lang]/mi-cuenta/preferencias/index.astro'),
    'utf8'
);

describe('account layout whats-new wiring', () => {
    it('renders the whats-new badge in the account navigation', () => {
        expect(accountLayoutSource).toContain(
            "import { WhatsNewBadge } from '@/components/shared/whats-new/WhatsNewBadge.client';"
        );
        expect(accountLayoutSource).toContain(
            "section === 'novedades' && <WhatsNewBadge locale={locale} client:idle />"
        );
    });

    it('maps the edit profile link to the profile tour target', () => {
        expect(accountLayoutSource).toContain("if (section === 'editar') return 'profile';");
        expect(accountLayoutSource).toContain(
            "{...(tourTarget ? { 'data-tour': tourTarget } : {})}"
        );
    });

    it('mounts the dashboard controller and restart-tour entry points', () => {
        expect(dashboardSource).toContain('<DashboardController');
        expect(preferencesSource).toContain(
            '<RestartTour client:idle locale={locale} userRole={user.role} />'
        );
    });
});
