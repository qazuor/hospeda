import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { ACCOUNT_NAV_GROUPS } from '../../src/config/navigation';

const accountHeaderSource = readFileSync(
    resolve(__dirname, '../../src/layouts/AccountHeader.astro'),
    'utf8'
);
const sidebarSource = readFileSync(
    resolve(__dirname, '../../src/components/account/ui/AccountSidebar.tsx'),
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
    it('renders the whats-new count pill on the account header icon (HOS-2550)', () => {
        expect(accountHeaderSource).toContain(
            "import { WhatsNewCountPill } from '@/components/shared/whats-new/WhatsNewCountPill.client';"
        );
        expect(accountHeaderSource).toContain(
            '<WhatsNewCountPill locale={locale} labelsParentLink client:idle />'
        );
    });

    it('maps the edit profile link to the profile tour target via the nav config', () => {
        const editProfileItem = ACCOUNT_NAV_GROUPS.flatMap((group) => group.items).find(
            (item) => item.id === 'editProfile'
        );
        expect(editProfileItem?.tourTarget).toBe('profile');
        expect(sidebarSource).toContain('data-tour={item.tourTarget}');
    });

    it('mounts the dashboard controller and restart-tour entry points', () => {
        expect(dashboardSource).toContain('<DashboardController');
        expect(preferencesSource).toContain(
            '<RestartTour client:idle locale={locale} userRoles={user.roles} />'
        );
    });
});
