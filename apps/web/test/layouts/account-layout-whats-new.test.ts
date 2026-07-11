import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ACCOUNT_NAV_GROUPS } from '../../src/config/navigation';

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
            "item.id === 'whatsNew' && <WhatsNewBadge locale={locale} client:idle />"
        );
    });

    it('maps the edit profile link to the profile tour target via the nav config', () => {
        const editProfileItem = ACCOUNT_NAV_GROUPS.flatMap((group) => group.items).find(
            (item) => item.id === 'editProfile'
        );
        expect(editProfileItem?.tourTarget).toBe('profile');
        expect(accountLayoutSource).toContain(
            "{...(item.tourTarget ? { 'data-tour': item.tourTarget } : {})}"
        );
    });

    it('mounts the dashboard controller and restart-tour entry points', () => {
        expect(dashboardSource).toContain('<DashboardController');
        expect(preferencesSource).toContain(
            '<RestartTour client:idle locale={locale} userRole={user.role} />'
        );
    });
});
