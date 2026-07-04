/**
 * @file Marketing hub route test (HOS-66 T-026, AC-7).
 *
 * Verifies the `/marketing` landing page renders and links to both
 * marketing sub-sections at the correct paths.
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import * as mod from '../../../../src/routes/_authed/marketing/index';

describe('Route /_authed/marketing/', () => {
    it('renders the page title and links to /social and /newsletter/campaigns', () => {
        const Page = (mod.Route as unknown as { options: { component: React.ComponentType } })
            .options.component;

        render(<Page />);

        // Title + subtitle keys come through verbatim (mocked t).
        expect(screen.getByText('admin-pages.marketing.social.title')).toBeInTheDocument();
        expect(screen.getByText('admin-pages.marketing.newsletter.title')).toBeInTheDocument();

        // Both cards must link to the correct, existing routes.
        const socialLink = screen.getByText('admin-pages.marketing.social.title').closest('a');
        const newsletterLink = screen
            .getByText('admin-pages.marketing.newsletter.title')
            .closest('a');

        expect(socialLink).toHaveAttribute('href', '/social');
        expect(newsletterLink).toHaveAttribute('href', '/newsletter/campaigns');
    });
});
