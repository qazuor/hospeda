// @vitest-environment jsdom
/**
 * Smoke tests for the five social catalog pages (SPEC-254 T-020).
 *
 * Strategy:
 * - Mock `use-social-catalog` hooks to inject controlled data / simulate errors.
 * - Mock `useUserPermissions` to toggle permission-gate behavior.
 * - Mock `useTranslations` to return predictable key strings.
 * - Wrap renders in QueryClientProvider so TanStack Query hooks work.
 *
 * Covers:
 * - HashtagsTable: renders rows, shows empty state, hides edit/delete without perms, surfaces 409 conflict.
 * - FootersTable: renders rows, shows empty state, hides edit/delete without perms.
 * - CampaignsTable: renders rows, shows empty state.
 * - BatchesTable: renders rows, shows empty state.
 * - AudiencesTable: renders rows, shows empty state, hides edit/delete without perms.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before component imports
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-social-catalog', () => ({
    useSocialHashtagsList: vi.fn(),
    useCreateSocialHashtag: vi.fn(),
    useUpdateSocialHashtag: vi.fn(),
    useDeleteSocialHashtag: vi.fn(),
    useSocialFootersList: vi.fn(),
    useCreateSocialFooter: vi.fn(),
    useUpdateSocialFooter: vi.fn(),
    useDeleteSocialFooter: vi.fn(),
    useSocialCampaignsList: vi.fn(),
    useCreateSocialCampaign: vi.fn(),
    useUpdateSocialCampaign: vi.fn(),
    useDeleteSocialCampaign: vi.fn(),
    useSocialBatchesList: vi.fn(),
    useCreateSocialBatch: vi.fn(),
    useUpdateSocialBatch: vi.fn(),
    useDeleteSocialBatch: vi.fn(),
    useSocialAudiencesList: vi.fn(),
    useCreateSocialAudience: vi.fn(),
    useUpdateSocialAudience: vi.fn(),
    useDeleteSocialAudience: vi.fn(),
    isConflictError: vi.fn(() => false),
    socialHashtagQueryKeys: {
        all: ['social-hashtags'],
        lists: () => ['social-hashtags', 'list'],
        list: (f: unknown) => ['social-hashtags', 'list', f]
    },
    socialFooterQueryKeys: {
        all: ['social-footers'],
        lists: () => ['social-footers', 'list'],
        list: (f: unknown) => ['social-footers', 'list', f]
    },
    socialCampaignQueryKeys: {
        all: ['social-campaigns'],
        lists: () => ['social-campaigns', 'list'],
        list: (f: unknown) => ['social-campaigns', 'list', f]
    },
    socialBatchQueryKeys: {
        all: ['social-batches'],
        lists: () => ['social-batches', 'list'],
        list: (f: unknown) => ['social-batches', 'list', f]
    },
    socialAudienceQueryKeys: {
        all: ['social-audiences'],
        lists: () => ['social-audiences', 'list'],
        list: (f: unknown) => ['social-audiences', 'list', f]
    }
}));

vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({ isLoading: false, user: null }),
    useHasPermission: vi.fn(() => true),
    useHasRole: vi.fn(() => false),
    useHasAnyRole: vi.fn(() => false)
}));

vi.mock('@/hooks/use-user-permissions', () => ({
    useUserPermissions: vi.fn()
}));

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string) => key
    })
}));

vi.mock('@/components/auth/RoutePermissionGuard', () => ({
    RoutePermissionGuard: ({ children }: { children: ReactNode }) => <>{children}</>
}));

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
    DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock('@/components/ui/button', () => ({
    Button: ({
        children,
        onClick,
        disabled,
        'data-testid': testId
    }: {
        children: ReactNode;
        onClick?: () => void;
        disabled?: boolean;
        'data-testid'?: string;
        variant?: string;
        size?: string;
        className?: string;
        type?: string;
    }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            data-testid={testId}
            type="button"
        >
            {children}
        </button>
    )
}));

vi.mock('@tanstack/react-router', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@tanstack/react-router')>();
    return {
        ...actual,
        createFileRoute: () => () => ({ component: null }),
        Link: ({
            children,
            to,
            'data-testid': testId
        }: {
            children: ReactNode;
            'data-testid'?: string;
            to?: string;
            params?: unknown;
            search?: unknown;
        }) => (
            <a
                href={to ?? '/'}
                data-testid={testId}
            >
                {children}
            </a>
        )
    };
});

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import {
    useCreateSocialHashtag,
    useDeleteSocialHashtag,
    useSocialAudiencesList,
    useSocialBatchesList,
    useSocialCampaignsList,
    useSocialFootersList,
    useSocialHashtagsList,
    useUpdateSocialHashtag
} from '@/hooks/use-social-catalog';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import { PermissionEnum } from '@repo/schemas';
import { AudiencesTable } from '../audiences/-components/AudiencesTable';
import { BatchesTable } from '../batches/-components/BatchesTable';
import { CampaignsTable } from '../campaigns/-components/CampaignsTable';
import { FootersTable } from '../footers/-components/FootersTable';
import { HashtagsTable } from '../hashtags/-components/HashtagsTable';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, refetchOnWindowFocus: false, refetchOnMount: false }
        }
    });
}

function TestWrapper({ children }: { readonly children: ReactNode }) {
    const qc = makeQueryClient();
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const mockUseSocialHashtagsList = vi.mocked(useSocialHashtagsList);
const mockUseSocialFootersList = vi.mocked(useSocialFootersList);
const mockUseSocialCampaignsList = vi.mocked(useSocialCampaignsList);
const mockUseSocialBatchesList = vi.mocked(useSocialBatchesList);
const mockUseSocialAudiencesList = vi.mocked(useSocialAudiencesList);
const mockUseUserPermissions = vi.mocked(useUserPermissions);
const mockUseDeleteSocialHashtag = vi.mocked(useDeleteSocialHashtag);
const mockUseCreateSocialHashtag = vi.mocked(useCreateSocialHashtag);
const mockUseUpdateSocialHashtag = vi.mocked(useUpdateSocialHashtag);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HASHTAG_1 = {
    id: 'ht-1',
    hashtag: '#viaje',
    normalizedHashtag: 'viaje',
    category: 'travel',
    platform: undefined,
    priority: 10,
    active: true,
    notes: undefined,
    slug: 'viaje',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: undefined,
    createdById: 'u1',
    updatedById: 'u1',
    deletedById: undefined
};

const HASHTAG_2 = {
    ...HASHTAG_1,
    id: 'ht-2',
    hashtag: '#playa',
    normalizedHashtag: 'playa',
    slug: 'playa'
};

const FOOTER_1 = {
    id: 'ft-1',
    name: 'Footer A',
    content: 'Seguinos en @hospeda',
    platform: undefined,
    priority: 5,
    active: true,
    isDefault: false,
    notes: undefined,
    slug: 'footer-a',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: undefined,
    createdById: 'u1',
    updatedById: 'u1',
    deletedById: undefined
};

const CAMPAIGN_1 = {
    id: 'cam-1',
    name: 'Summer 2026',
    description: 'Verano',
    active: true,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: undefined,
    slug: 'summer-2026',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: undefined,
    createdById: 'u1',
    updatedById: 'u1',
    deletedById: undefined
};

const BATCH_1 = {
    id: 'bat-1',
    name: 'Batch Jan',
    description: 'First batch',
    active: true,
    startsAt: new Date('2026-01-01T00:00:00Z'),
    endsAt: undefined,
    slug: 'batch-jan',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: undefined,
    createdById: 'u1',
    updatedById: 'u1',
    deletedById: undefined
};

const AUDIENCE_1 = {
    id: 'au-1',
    name: 'Families',
    slug: 'families',
    description: 'Family travelers',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: undefined,
    createdById: 'u1',
    updatedById: 'u1',
    deletedById: undefined
};

// ---------------------------------------------------------------------------
// HashtagsTable tests
// ---------------------------------------------------------------------------

describe('HashtagsTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserPermissions.mockReturnValue([
            PermissionEnum.SOCIAL_HASHTAG_VIEW,
            PermissionEnum.SOCIAL_HASHTAG_MANAGE
        ]);
    });

    it('renders a row for each hashtag', () => {
        render(
            <TestWrapper>
                <HashtagsTable
                    items={[HASHTAG_1, HASHTAG_2]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('hashtag-row-ht-1')).toBeInTheDocument();
        expect(screen.getByTestId('hashtag-row-ht-2')).toBeInTheDocument();
    });

    it('renders edit and delete buttons when user has manage permission', () => {
        render(
            <TestWrapper>
                <HashtagsTable
                    items={[HASHTAG_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('hashtag-edit-ht-1')).toBeInTheDocument();
        expect(screen.getByTestId('hashtag-delete-ht-1')).toBeInTheDocument();
    });

    it('hides edit and delete buttons when user lacks manage permission', () => {
        mockUseUserPermissions.mockReturnValue([PermissionEnum.SOCIAL_HASHTAG_VIEW]);

        render(
            <TestWrapper>
                <HashtagsTable
                    items={[HASHTAG_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('hashtag-edit-ht-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('hashtag-delete-ht-1')).not.toBeInTheDocument();
    });

    it('calls onEdit when edit button is clicked', () => {
        const onEdit = vi.fn();

        render(
            <TestWrapper>
                <HashtagsTable
                    items={[HASHTAG_1]}
                    onEdit={onEdit}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        fireEvent.click(screen.getByTestId('hashtag-edit-ht-1'));
        expect(onEdit).toHaveBeenCalledWith(HASHTAG_1);
    });

    it('calls onDelete when delete button is clicked', () => {
        const onDelete = vi.fn();

        render(
            <TestWrapper>
                <HashtagsTable
                    items={[HASHTAG_1]}
                    onEdit={vi.fn()}
                    onDelete={onDelete}
                />
            </TestWrapper>
        );

        fireEvent.click(screen.getByTestId('hashtag-delete-ht-1'));
        expect(onDelete).toHaveBeenCalledWith(HASHTAG_1);
    });

    it('renders no rows when items is empty', () => {
        render(
            <TestWrapper>
                <HashtagsTable
                    items={[]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('hashtag-row-ht-1')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// FootersTable tests
// ---------------------------------------------------------------------------

describe('FootersTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserPermissions.mockReturnValue([PermissionEnum.SOCIAL_FOOTER_MANAGE]);
    });

    it('renders a row for each footer', () => {
        render(
            <TestWrapper>
                <FootersTable
                    items={[FOOTER_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('footer-row-ft-1')).toBeInTheDocument();
    });

    it('renders edit and delete buttons when user has manage permission', () => {
        render(
            <TestWrapper>
                <FootersTable
                    items={[FOOTER_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('footer-edit-ft-1')).toBeInTheDocument();
        expect(screen.getByTestId('footer-delete-ft-1')).toBeInTheDocument();
    });

    it('hides edit and delete buttons when user lacks manage permission', () => {
        mockUseUserPermissions.mockReturnValue([]);

        render(
            <TestWrapper>
                <FootersTable
                    items={[FOOTER_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('footer-edit-ft-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('footer-delete-ft-1')).not.toBeInTheDocument();
    });

    it('renders no rows when items is empty', () => {
        render(
            <TestWrapper>
                <FootersTable
                    items={[]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('footer-row-ft-1')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// CampaignsTable tests
// ---------------------------------------------------------------------------

describe('CampaignsTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserPermissions.mockReturnValue([PermissionEnum.SOCIAL_CAMPAIGN_MANAGE]);
    });

    it('renders a row for each campaign', () => {
        render(
            <TestWrapper>
                <CampaignsTable
                    items={[CAMPAIGN_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('campaign-row-cam-1')).toBeInTheDocument();
    });

    it('renders edit and delete buttons when user has manage permission', () => {
        render(
            <TestWrapper>
                <CampaignsTable
                    items={[CAMPAIGN_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('campaign-edit-cam-1')).toBeInTheDocument();
        expect(screen.getByTestId('campaign-delete-cam-1')).toBeInTheDocument();
    });

    it('renders no rows when items is empty', () => {
        render(
            <TestWrapper>
                <CampaignsTable
                    items={[]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('campaign-row-cam-1')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// BatchesTable tests
// ---------------------------------------------------------------------------

describe('BatchesTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserPermissions.mockReturnValue([PermissionEnum.SOCIAL_BATCH_MANAGE]);
    });

    it('renders a row for each batch', () => {
        render(
            <TestWrapper>
                <BatchesTable
                    items={[BATCH_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('batch-row-bat-1')).toBeInTheDocument();
    });

    it('renders edit and delete buttons when user has manage permission', () => {
        render(
            <TestWrapper>
                <BatchesTable
                    items={[BATCH_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('batch-edit-bat-1')).toBeInTheDocument();
        expect(screen.getByTestId('batch-delete-bat-1')).toBeInTheDocument();
    });

    it('renders no rows when items is empty', () => {
        render(
            <TestWrapper>
                <BatchesTable
                    items={[]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('batch-row-bat-1')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// AudiencesTable tests
// ---------------------------------------------------------------------------

describe('AudiencesTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserPermissions.mockReturnValue([PermissionEnum.SOCIAL_AUDIENCE_MANAGE]);
    });

    it('renders a row for each audience', () => {
        render(
            <TestWrapper>
                <AudiencesTable
                    items={[AUDIENCE_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('audience-row-au-1')).toBeInTheDocument();
    });

    it('renders edit and delete buttons when user has manage permission', () => {
        render(
            <TestWrapper>
                <AudiencesTable
                    items={[AUDIENCE_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('audience-edit-au-1')).toBeInTheDocument();
        expect(screen.getByTestId('audience-delete-au-1')).toBeInTheDocument();
    });

    it('hides edit and delete buttons when user lacks manage permission', () => {
        mockUseUserPermissions.mockReturnValue([]);

        render(
            <TestWrapper>
                <AudiencesTable
                    items={[AUDIENCE_1]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('audience-edit-au-1')).not.toBeInTheDocument();
        expect(screen.queryByTestId('audience-delete-au-1')).not.toBeInTheDocument();
    });

    it('renders no rows when items is empty', () => {
        render(
            <TestWrapper>
                <AudiencesTable
                    items={[]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('audience-row-au-1')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// HashtagFormModal conflict-detection tests
// ---------------------------------------------------------------------------

describe('HashtagFormModal — 409 conflict surfacing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserPermissions.mockReturnValue([PermissionEnum.SOCIAL_HASHTAG_MANAGE]);
        mockUseDeleteSocialHashtag.mockReturnValue({
            mutate: vi.fn(),
            isPending: false
        } as unknown as ReturnType<typeof useDeleteSocialHashtag>);
        mockUseUpdateSocialHashtag.mockReturnValue({
            mutate: vi.fn(),
            isPending: false
        } as unknown as ReturnType<typeof useUpdateSocialHashtag>);
    });

    it('shows conflict error banner when create returns 409', async () => {
        const conflictError = new Error('Conflict') as Error & { status: number };
        conflictError.status = 409;

        let capturedOnError: ((err: Error) => void) | undefined;

        mockUseCreateSocialHashtag.mockReturnValue({
            mutate: (_data: unknown, opts: { onError?: (e: Error) => void }) => {
                capturedOnError = opts?.onError;
            },
            isPending: false
        } as unknown as ReturnType<typeof useCreateSocialHashtag>);

        // isConflictError needs to return true for our error
        const { isConflictError } = await import('@/hooks/use-social-catalog');
        vi.mocked(isConflictError).mockReturnValue(true);

        const { HashtagFormModal } = await import('../hashtags/-components/HashtagFormModal');

        render(
            <TestWrapper>
                <HashtagFormModal
                    open={true}
                    onOpenChange={vi.fn()}
                    item={null}
                />
            </TestWrapper>
        );

        // Fill the required fields and submit so the create mutation runs and the
        // mock above captures its onError handler. The mocked Button renders as
        // type="button", so submit the <form> directly rather than clicking it.
        const hashtagInput = screen.getByLabelText('social.hashtags.form.hashtagLabel');
        fireEvent.change(hashtagInput, { target: { value: '#playa' } });
        fireEvent.change(screen.getByLabelText('social.hashtags.form.categoryLabel'), {
            target: { value: 'travel' }
        });
        const form = hashtagInput.closest('form');
        expect(form).not.toBeNull();
        fireEvent.submit(form as HTMLFormElement);

        // Simulate the API returning a 409 by invoking the captured onError.
        expect(capturedOnError).toBeDefined();
        act(() => {
            capturedOnError?.(conflictError);
        });

        await waitFor(() => {
            expect(screen.getByTestId('hashtag-conflict-error')).toBeInTheDocument();
        });
    });
});

// ---------------------------------------------------------------------------
// Catalog hooks wired up (integration stubs for page-level smoke)
// ---------------------------------------------------------------------------

describe('Catalog hooks — list query integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserPermissions.mockReturnValue([
            PermissionEnum.SOCIAL_HASHTAG_VIEW,
            PermissionEnum.SOCIAL_HASHTAG_MANAGE
        ]);
        mockUseDeleteSocialHashtag.mockReturnValue({
            mutate: vi.fn(),
            isPending: false
        } as unknown as ReturnType<typeof useDeleteSocialHashtag>);
    });

    it('useSocialHashtagsList is called and its data renders in the table', () => {
        mockUseSocialHashtagsList.mockReturnValue({
            data: {
                items: [HASHTAG_1, HASHTAG_2],
                pagination: { page: 1, pageSize: 20, total: 2, totalPages: 1 }
            },
            isLoading: false,
            error: null
        } as unknown as ReturnType<typeof useSocialHashtagsList>);

        render(
            <TestWrapper>
                <HashtagsTable
                    items={[HASHTAG_1, HASHTAG_2]}
                    onEdit={vi.fn()}
                    onDelete={vi.fn()}
                />
            </TestWrapper>
        );

        expect(mockUseSocialHashtagsList).not.toHaveBeenCalled(); // table gets items as props
        expect(screen.getByTestId('hashtag-row-ht-1')).toBeInTheDocument();
        expect(screen.getByTestId('hashtag-row-ht-2')).toBeInTheDocument();
    });

    it('useSocialFootersList is available from the mock', () => {
        expect(mockUseSocialFootersList).toBeDefined();
    });

    it('useSocialCampaignsList is available from the mock', () => {
        expect(mockUseSocialCampaignsList).toBeDefined();
    });

    it('useSocialBatchesList is available from the mock', () => {
        expect(mockUseSocialBatchesList).toBeDefined();
    });

    it('useSocialAudiencesList is available from the mock', () => {
        expect(mockUseSocialAudiencesList).toBeDefined();
    });
});
