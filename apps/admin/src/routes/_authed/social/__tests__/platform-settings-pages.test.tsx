// @vitest-environment jsdom
/**
 * Smoke tests for the platform-formats and settings admin pages (SPEC-254 T-021).
 *
 * Strategy:
 * - Mock `use-social-platform-settings` hooks to inject controlled data.
 * - Mock `useUserPermissions` to toggle permission-gate behavior.
 * - Mock `useTranslations` to return predictable key strings.
 * - Wrap renders in QueryClientProvider so TanStack Query hooks work.
 *
 * Covers:
 * - PlatformFormatsTable: renders rows, shows edit button with manage perm, hides without.
 * - PlatformFormatFormModal: shows amber warning when disabling an enabled format.
 * - SettingsTable: renders rows, shows type badge, displays masked value for secrets.
 * - SettingEditModal: shows secret hint for secret-typed settings, hides for others.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be declared before component imports
// ---------------------------------------------------------------------------

vi.mock('@/hooks/use-social-platform-settings', () => ({
    usePlatformFormatsList: vi.fn(),
    useUpdatePlatformFormat: vi.fn(),
    useSocialSettingsList: vi.fn(),
    useUpdateSocialSetting: vi.fn(),
    socialPlatformFormatQueryKeys: {
        all: ['social-platform-formats'],
        lists: () => ['social-platform-formats', 'list'],
        list: (f: unknown) => ['social-platform-formats', 'list', f]
    },
    socialSettingQueryKeys: {
        all: ['social-settings'],
        lists: () => ['social-settings', 'list'],
        list: (f: unknown) => ['social-settings', 'list', f]
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
    Dialog: ({ children, open }: { children: ReactNode; open?: boolean }) =>
        open ? <div data-testid="dialog">{children}</div> : null,
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
        'data-testid': testId,
        type
    }: {
        children: ReactNode;
        onClick?: () => void;
        disabled?: boolean;
        'data-testid'?: string;
        variant?: string;
        size?: string;
        className?: string;
        type?: 'button' | 'submit' | 'reset';
    }) => (
        <button
            onClick={onClick}
            disabled={disabled}
            data-testid={testId}
            type={type ?? 'button'}
        >
            {children}
        </button>
    )
}));

vi.mock('@/components/ui/input', () => ({
    Input: ({
        id,
        value,
        onChange,
        type,
        placeholder,
        required,
        min
    }: {
        id?: string;
        value?: string | number;
        onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
        type?: string;
        placeholder?: string;
        required?: boolean;
        min?: number;
        className?: string;
    }) => (
        <input
            id={id}
            value={value}
            onChange={onChange}
            type={type ?? 'text'}
            placeholder={placeholder}
            required={required}
            min={min}
        />
    )
}));

vi.mock('@/components/ui/label', () => ({
    Label: ({
        children,
        htmlFor,
        className
    }: {
        children: ReactNode;
        htmlFor?: string;
        className?: string;
    }) => (
        <label
            htmlFor={htmlFor}
            className={className}
        >
            {children}
        </label>
    )
}));

vi.mock('@/components/ui/textarea', () => ({
    Textarea: ({
        id,
        value,
        onChange,
        rows
    }: {
        id?: string;
        value?: string;
        onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
        rows?: number;
    }) => (
        <textarea
            id={id}
            value={value}
            onChange={onChange}
            rows={rows}
        />
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
    useUpdatePlatformFormat,
    useUpdateSocialSetting
} from '@/hooks/use-social-platform-settings';
import { useUserPermissions } from '@/hooks/use-user-permissions';
import {
    PermissionEnum,
    SocialMediaTypeEnum,
    SocialPlatformEnum,
    SocialPublishFormatEnum
} from '@repo/schemas';
import { PlatformFormatFormModal } from '../platform-formats/-components/PlatformFormatFormModal';
import { PlatformFormatsTable } from '../platform-formats/-components/PlatformFormatsTable';
import { SettingEditModal } from '../settings/-components/SettingEditModal';
import { SettingsTable } from '../settings/-components/SettingsTable';

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

const mockUseUserPermissions = vi.mocked(useUserPermissions);
const mockUseUpdatePlatformFormat = vi.mocked(useUpdatePlatformFormat);
const mockUseUpdateSocialSetting = vi.mocked(useUpdateSocialSetting);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PLATFORM_FORMAT_1 = {
    id: 'pf-1',
    platform: SocialPlatformEnum.INSTAGRAM,
    publishFormat: SocialPublishFormatEnum.FEED_POST,
    mediaType: SocialMediaTypeEnum.IMAGE,
    enabled: true,
    mvpEnabled: true,
    recommendedRatio: '1:1',
    recommendedSize: '1080x1080',
    maxCaptionLength: 2200,
    requiresPublicUrl: false,
    requiresMedia: true,
    makeChannelKey: 'instagram_feed',
    notes: undefined,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: undefined,
    createdById: 'u1',
    updatedById: 'u1',
    deletedById: undefined
};

const PLATFORM_FORMAT_2 = {
    ...PLATFORM_FORMAT_1,
    id: 'pf-2',
    platform: SocialPlatformEnum.FACEBOOK,
    publishFormat: SocialPublishFormatEnum.STORY,
    enabled: false,
    makeChannelKey: undefined,
    maxCaptionLength: undefined
};

const SETTING_SECRET = {
    id: 'st-1',
    key: 'make_webhook_url',
    value: '***',
    type: 'secret' as const,
    active: true,
    description: 'URL del webhook de Make.com',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
};

const SETTING_STRING = {
    id: 'st-2',
    key: 'default_timezone',
    value: 'America/Argentina/Buenos_Aires',
    type: 'string' as const,
    active: true,
    description: 'Zona horaria por defecto',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z')
};

// ---------------------------------------------------------------------------
// PlatformFormatsTable tests
// ---------------------------------------------------------------------------

describe('PlatformFormatsTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserPermissions.mockReturnValue([
            PermissionEnum.SOCIAL_PLATFORM_FORMAT_VIEW,
            PermissionEnum.SOCIAL_PLATFORM_MANAGE
        ]);
    });

    it('renders a row for each platform format', () => {
        render(
            <TestWrapper>
                <PlatformFormatsTable
                    items={[PLATFORM_FORMAT_1, PLATFORM_FORMAT_2]}
                    onEdit={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('platform-format-row-pf-1')).toBeInTheDocument();
        expect(screen.getByTestId('platform-format-row-pf-2')).toBeInTheDocument();
    });

    it('renders edit button when user has SOCIAL_PLATFORM_MANAGE permission', () => {
        render(
            <TestWrapper>
                <PlatformFormatsTable
                    items={[PLATFORM_FORMAT_1]}
                    onEdit={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('platform-format-edit-pf-1')).toBeInTheDocument();
    });

    it('hides edit button when user lacks SOCIAL_PLATFORM_MANAGE permission', () => {
        mockUseUserPermissions.mockReturnValue([PermissionEnum.SOCIAL_PLATFORM_FORMAT_VIEW]);

        render(
            <TestWrapper>
                <PlatformFormatsTable
                    items={[PLATFORM_FORMAT_1]}
                    onEdit={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('platform-format-edit-pf-1')).not.toBeInTheDocument();
    });

    it('calls onEdit when edit button is clicked', () => {
        const onEdit = vi.fn();

        render(
            <TestWrapper>
                <PlatformFormatsTable
                    items={[PLATFORM_FORMAT_1]}
                    onEdit={onEdit}
                />
            </TestWrapper>
        );

        fireEvent.click(screen.getByTestId('platform-format-edit-pf-1'));
        expect(onEdit).toHaveBeenCalledWith(PLATFORM_FORMAT_1);
    });

    it('renders no rows when items is empty', () => {
        render(
            <TestWrapper>
                <PlatformFormatsTable
                    items={[]}
                    onEdit={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('platform-format-row-pf-1')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// PlatformFormatFormModal — active-targets disable warning tests
// ---------------------------------------------------------------------------

describe('PlatformFormatFormModal — disable warning', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserPermissions.mockReturnValue([PermissionEnum.SOCIAL_PLATFORM_MANAGE]);
        mockUseUpdatePlatformFormat.mockReturnValue({
            mutate: vi.fn(),
            isPending: false
        } as unknown as ReturnType<typeof useUpdatePlatformFormat>);
    });

    it('shows amber warning when toggling enabled=true to enabled=false', async () => {
        render(
            <TestWrapper>
                <PlatformFormatFormModal
                    open={true}
                    onOpenChange={vi.fn()}
                    item={PLATFORM_FORMAT_1}
                />
            </TestWrapper>
        );

        // Initially PLATFORM_FORMAT_1.enabled = true, warning should NOT be shown
        expect(screen.queryByTestId('platform-format-disable-warning')).not.toBeInTheDocument();

        // Uncheck the enabled checkbox (use the DOM id since label text is a translation key)
        const checkboxEl = document.getElementById('pf-enabled') as HTMLInputElement;
        expect(checkboxEl).not.toBeNull();

        fireEvent.click(checkboxEl);

        await waitFor(() => {
            expect(screen.getByTestId('platform-format-disable-warning')).toBeInTheDocument();
        });
    });

    it('does NOT show warning when item is already disabled', () => {
        render(
            <TestWrapper>
                <PlatformFormatFormModal
                    open={true}
                    onOpenChange={vi.fn()}
                    item={PLATFORM_FORMAT_2}
                />
            </TestWrapper>
        );

        // PLATFORM_FORMAT_2.enabled = false, disabling-warning must not show
        expect(screen.queryByTestId('platform-format-disable-warning')).not.toBeInTheDocument();
    });

    it('saves the form by submitting and calls mutate', () => {
        const mutate = vi.fn();
        mockUseUpdatePlatformFormat.mockReturnValue({
            mutate,
            isPending: false
        } as unknown as ReturnType<typeof useUpdatePlatformFormat>);

        render(
            <TestWrapper>
                <PlatformFormatFormModal
                    open={true}
                    onOpenChange={vi.fn()}
                    item={PLATFORM_FORMAT_1}
                />
            </TestWrapper>
        );

        const makeKeyInput = document.getElementById('pf-make-key') as HTMLInputElement;
        expect(makeKeyInput).not.toBeNull();
        fireEvent.change(makeKeyInput, { target: { value: 'instagram_feed_v2' } });

        const form = makeKeyInput.closest('form');
        expect(form).not.toBeNull();
        fireEvent.submit(form as HTMLFormElement);

        expect(mutate).toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// SettingsTable tests
// ---------------------------------------------------------------------------

describe('SettingsTable', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserPermissions.mockReturnValue([PermissionEnum.SOCIAL_SETTINGS_MANAGE]);
    });

    it('renders a row for each setting', () => {
        render(
            <TestWrapper>
                <SettingsTable
                    items={[SETTING_SECRET, SETTING_STRING]}
                    onEdit={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('setting-row-st-1')).toBeInTheDocument();
        expect(screen.getByTestId('setting-row-st-2')).toBeInTheDocument();
    });

    it('displays the masked value "***" for secret-typed settings', () => {
        render(
            <TestWrapper>
                <SettingsTable
                    items={[SETTING_SECRET]}
                    onEdit={vi.fn()}
                />
            </TestWrapper>
        );

        const valueCell = screen.getByTestId('setting-value-st-1');
        expect(valueCell).toHaveTextContent('***');
    });

    it('displays the actual value for non-secret settings', () => {
        render(
            <TestWrapper>
                <SettingsTable
                    items={[SETTING_STRING]}
                    onEdit={vi.fn()}
                />
            </TestWrapper>
        );

        const valueCell = screen.getByTestId('setting-value-st-2');
        expect(valueCell).toHaveTextContent('America/Argentina/Buenos_Aires');
    });

    it('renders a type badge for each setting', () => {
        render(
            <TestWrapper>
                <SettingsTable
                    items={[SETTING_SECRET, SETTING_STRING]}
                    onEdit={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('setting-type-badge-st-1')).toHaveTextContent('secret');
        expect(screen.getByTestId('setting-type-badge-st-2')).toHaveTextContent('string');
    });

    it('renders edit button when user has SOCIAL_SETTINGS_MANAGE permission', () => {
        render(
            <TestWrapper>
                <SettingsTable
                    items={[SETTING_SECRET]}
                    onEdit={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('setting-edit-st-1')).toBeInTheDocument();
    });

    it('hides edit button when user lacks SOCIAL_SETTINGS_MANAGE permission', () => {
        mockUseUserPermissions.mockReturnValue([]);

        render(
            <TestWrapper>
                <SettingsTable
                    items={[SETTING_SECRET]}
                    onEdit={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('setting-edit-st-1')).not.toBeInTheDocument();
    });

    it('calls onEdit when edit button is clicked', () => {
        const onEdit = vi.fn();

        render(
            <TestWrapper>
                <SettingsTable
                    items={[SETTING_STRING]}
                    onEdit={onEdit}
                />
            </TestWrapper>
        );

        fireEvent.click(screen.getByTestId('setting-edit-st-2'));
        expect(onEdit).toHaveBeenCalledWith(SETTING_STRING);
    });

    it('renders no rows when items is empty', () => {
        render(
            <TestWrapper>
                <SettingsTable
                    items={[]}
                    onEdit={vi.fn()}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('setting-row-st-1')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// SettingEditModal tests
// ---------------------------------------------------------------------------

describe('SettingEditModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseUserPermissions.mockReturnValue([PermissionEnum.SOCIAL_SETTINGS_MANAGE]);
        mockUseUpdateSocialSetting.mockReturnValue({
            mutate: vi.fn(),
            isPending: false
        } as unknown as ReturnType<typeof useUpdateSocialSetting>);
    });

    it('shows secret hint for secret-typed settings', () => {
        render(
            <TestWrapper>
                <SettingEditModal
                    open={true}
                    onOpenChange={vi.fn()}
                    item={SETTING_SECRET}
                />
            </TestWrapper>
        );

        expect(screen.getByTestId('setting-secret-hint')).toBeInTheDocument();
    });

    it('does NOT show secret hint for non-secret settings', () => {
        render(
            <TestWrapper>
                <SettingEditModal
                    open={true}
                    onOpenChange={vi.fn()}
                    item={SETTING_STRING}
                />
            </TestWrapper>
        );

        expect(screen.queryByTestId('setting-secret-hint')).not.toBeInTheDocument();
    });

    it('calls mutate with key and value on form submit', () => {
        const mutate = vi.fn();
        mockUseUpdateSocialSetting.mockReturnValue({
            mutate,
            isPending: false
        } as unknown as ReturnType<typeof useUpdateSocialSetting>);

        render(
            <TestWrapper>
                <SettingEditModal
                    open={true}
                    onOpenChange={vi.fn()}
                    item={SETTING_STRING}
                />
            </TestWrapper>
        );

        const valueInput = document.getElementById('setting-value') as HTMLInputElement;
        expect(valueInput).not.toBeNull();

        fireEvent.change(valueInput, { target: { value: 'America/Buenos_Aires' } });

        const form = valueInput.closest('form');
        expect(form).not.toBeNull();
        fireEvent.submit(form as HTMLFormElement);

        expect(mutate).toHaveBeenCalledWith(
            { key: 'default_timezone', value: 'America/Buenos_Aires' },
            expect.any(Object)
        );
    });

    it('renders nothing when item is null', () => {
        const { container } = render(
            <TestWrapper>
                <SettingEditModal
                    open={true}
                    onOpenChange={vi.fn()}
                    item={null}
                />
            </TestWrapper>
        );

        // The modal should render nothing when item is null
        expect(container.querySelector('[data-testid="dialog"]')).toBeNull();
    });
});
