// @vitest-environment jsdom
/**
 * Tests for `ListingModerationCard` (HOS-686 AC-26; read-only since HOS-1641,
 * Coord-424).
 *
 * The card used to post `{ moderationState }` to `POST /:id/moderate`, a body
 * the action-based endpoint rejects with 400. It now shows the listing's
 * `publicationStatus` and must offer NO control: the action-based moderation
 * control arrives with HOS-1684.
 */

import { PublicationStatusEnum } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';
import { ListingModerationCard } from '../ListingModerationCard';

function renderCard(publicationStatus: PublicationStatusEnum | undefined) {
    return render(React.createElement(ListingModerationCard, { publicationStatus }));
}

describe('ListingModerationCard — read-only publication state (HOS-1641)', () => {
    it.each(Object.values(PublicationStatusEnum))('shows %s with its own label', (status) => {
        // Arrange / Act
        renderCard(status);

        // Assert
        const card = screen.getByTestId('listing-moderation');
        expect(card.textContent).toContain(
            `admin-filters.publicationStatus.${
                {
                    DRAFT: 'draft',
                    PUBLISHED: 'published',
                    UNPUBLISHED_BY_BILLING: 'unpublishedByBilling',
                    ARCHIVED: 'archived',
                    MODERATED: 'moderated',
                    PURGED: 'purged'
                }[status]
            }`
        );
    });

    it('offers no control at all: nothing to click, nothing to choose', () => {
        renderCard(PublicationStatusEnum.MODERATED);

        expect(screen.queryByRole('button')).toBeNull();
        expect(screen.queryByRole('combobox')).toBeNull();
        expect(screen.queryByRole('menu')).toBeNull();
    });

    it('renders no badge while the state is not loaded yet', () => {
        renderCard(undefined);

        expect(screen.getByTestId('listing-moderation').textContent).not.toContain(
            'admin-filters.publicationStatus'
        );
    });
});
