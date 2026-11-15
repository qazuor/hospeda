// @vitest-environment jsdom
import esAdminEntities from '@repo/i18n/locales/es/admin-entities.json';
import { PublicationStatusEnum } from '@repo/schemas';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ListingModerationActions } from '../ListingModerationActions';

function translateEs(key: string, params?: Readonly<Record<string, string>>): string {
    if (!key.startsWith('admin-entities.')) return key;
    const path = key.replace(/^admin-entities\./, '').split('.');
    let node: unknown = esAdminEntities;
    for (const segment of path) {
        node =
            typeof node === 'object' && node !== null
                ? (node as Record<string, unknown>)[segment]
                : undefined;
    }
    if (typeof node !== 'string') return key;
    return Object.entries(params ?? {}).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, value),
        node
    );
}

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({ t: translateEs, locale: 'es' })
}));
vi.mock('@/components/ui/ToastProvider', () => ({
    useToast: () => ({ addToast: vi.fn() })
}));
vi.mock('../../hooks/useModerateListingMutation', () => ({
    useModerateListingMutation: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

const readStateFixture = vi.hoisted(() => ({
    data: {
        publicationStatus: 'PUBLISHED',
        fixRequest: null,
        recurringListingAddons: [] as { addonVersionId: string; name: string }[]
    }
}));
vi.mock('../../hooks/useListingModerationStateQuery', () => ({
    useListingModerationStateQuery: () => ({
        data: readStateFixture.data,
        isPending: false,
        isError: false
    })
}));

const recurringAddons = [
    { addonVersionId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Destaque superior' },
    { addonVersionId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Portada semanal' }
];

async function openDialog({
    status,
    action,
    addons
}: {
    readonly status: PublicationStatusEnum;
    readonly action: 'TAKE_DOWN' | 'LIFT' | 'REQUEST_FIX';
    readonly addons: typeof recurringAddons;
}) {
    readStateFixture.data = {
        publicationStatus: status,
        fixRequest: null,
        recurringListingAddons: addons
    };
    render(
        <ListingModerationActions
            vertical="venue"
            entityId="cccccccc-cccc-cccc-cccc-cccccccccccc"
            entityName="La Cabaña"
        />
    );
    await userEvent.setup().click(screen.getByTestId(`listing-moderation-action-${action}`));
    return screen.getByTestId('listing-moderation-dialog');
}

function recurringParagraphs() {
    return Array.from(screen.getByTestId('listing-moderation-dialog').querySelectorAll('p')).filter(
        (paragraph) =>
            paragraph.textContent?.startsWith(
                esAdminEntities.listingModeration.dialog.takeDown.recurringIntro
            )
    );
}

beforeEach(() => {
    readStateFixture.data = {
        publicationStatus: PublicationStatusEnum.PUBLISHED,
        fixRequest: null,
        recurringListingAddons: []
    };
});

describe('TEST:B13b:1 AC:B13b:1 the moderation dialog names the recurring features', () => {
    it('names both recurring features and explains the continuing charge and cancellation notice', async () => {
        const dialog = await openDialog({
            status: PublicationStatusEnum.PUBLISHED,
            action: 'TAKE_DOWN',
            addons: recurringAddons
        });
        expect(
            screen.getAllByTestId('moderation-recurring-addon').map((item) => item.textContent)
        ).toEqual(['Destaque superior', 'Portada semanal']);
        expect(dialog).toHaveTextContent(
            esAdminEntities.listingModeration.dialog.takeDown.recurringIntro
        );
        expect(dialog).toHaveTextContent(
            esAdminEntities.listingModeration.dialog.takeDown.recurringChargeNotice
        );
        expect(recurringParagraphs()).toHaveLength(1);
    });

    it('shows no recurring paragraph when the state has zero features', async () => {
        await openDialog({
            status: PublicationStatusEnum.PUBLISHED,
            action: 'TAKE_DOWN',
            addons: []
        });
        expect(screen.queryAllByTestId('moderation-recurring-addon')).toHaveLength(0);
        expect(recurringParagraphs()).toHaveLength(0);
    });

    it.each([
        [PublicationStatusEnum.MODERATED, 'LIFT'],
        [PublicationStatusEnum.DRAFT, 'REQUEST_FIX']
    ] as const)('%s %s does not show the recurring paragraph', async (status, action) => {
        await openDialog({ status, action, addons: recurringAddons });
        expect(screen.queryAllByTestId('moderation-recurring-addon')).toHaveLength(0);
        expect(recurringParagraphs()).toHaveLength(0);
    });
});
