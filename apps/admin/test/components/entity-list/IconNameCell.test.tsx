/**
 * IconNameCell tests — lazy resolver path (SPEC-190, T-005).
 *
 * Covers:
 * 1. Em-dash fallback when iconName is null/undefined.
 * 2. Mono-slug fallback when iconName is unknown (resolveIcon returns undefined).
 * 3. Icon renders after async resolver resolves (lazy import path).
 * 4. Multiple rows with different icon names resolve independently.
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IconNameCell } from '@/components/entity-list/IconNameCell';

describe('IconNameCell', () => {
    it('renders em-dash when iconName is null', () => {
        render(<IconNameCell iconName={null} />);
        expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders em-dash when iconName is undefined', () => {
        render(<IconNameCell iconName={undefined} />);
        expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('renders mono-slug fallback when resolver returns undefined', async () => {
        // The mock resolver returns undefined for names that do NOT end in
        // "Icon", which exercises the genuine unresolved-icon branch: the slug
        // is shown in mono with no icon SVG next to it.
        render(<IconNameCell iconName="definitely-not-an-icon" />);
        await waitFor(() => {
            expect(screen.getByText('definitely-not-an-icon')).toBeInTheDocument();
        });
        expect(screen.queryByTestId('icon-definitely-not-an-icon')).not.toBeInTheDocument();
    });

    it('renders icon component after lazy resolver resolves', async () => {
        render(<IconNameCell iconName="WifiIcon" />);
        await waitFor(() => {
            expect(screen.getByTestId('icon-WifiIcon')).toBeInTheDocument();
        });
        // The slug text should also be present
        expect(screen.getByText('WifiIcon')).toBeInTheDocument();
    });

    it('renders different icons for different names', async () => {
        render(
            <div>
                <IconNameCell iconName="PoolIcon" />
                <IconNameCell iconName="CarIcon" />
            </div>
        );
        await waitFor(() => {
            expect(screen.getByTestId('icon-PoolIcon')).toBeInTheDocument();
            expect(screen.getByTestId('icon-CarIcon')).toBeInTheDocument();
        });
    });
});
