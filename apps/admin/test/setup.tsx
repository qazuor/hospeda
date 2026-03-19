/**
 * Test setup file for Vitest in Admin app
 * Configures test environment and global mocks for React components
 */

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { server } from './mocks/server';

// Inject required Vite env vars into import.meta.env for test environment.
// These are accessed by validateAdminEnv() in src/env.ts via import.meta.env.
// Setting them here prevents "Environment validation failed" errors in tests
// that indirectly import components which access env (e.g. EntityCreateContent).
Object.assign(import.meta.env, {
    VITE_API_URL: 'http://localhost:3001',
    VITE_SITE_URL: 'http://localhost:4321',
    HOSPEDA_API_URL: 'http://localhost:3001',
    VITE_BETTER_AUTH_URL: 'http://localhost:3001'
});

// Start MSW server before all tests
beforeAll(() => {
    // Setup test environment
    process.env.NODE_ENV = 'test';

    // Start MSW server to intercept HTTP requests
    server.listen({ onUnhandledRequest: 'warn' });
});

// Reset handlers after each test (important for test isolation)
afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    server.resetHandlers();
});

// Close MSW server after all tests
afterAll(() => {
    server.close();
});

// Radix UI PointerEvent polyfill for JSDOM (ref: radix-ui/primitives#1822)
class MockPointerEvent extends Event {
    readonly button: number;
    readonly ctrlKey: boolean;
    readonly pointerType: string;

    constructor(type: string, props: PointerEventInit = {}) {
        super(type, props);
        this.button = props.button ?? 0;
        this.ctrlKey = props.ctrlKey ?? false;
        this.pointerType = props.pointerType ?? 'mouse';
    }
}

window.PointerEvent = MockPointerEvent as any;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();

// ResizeObserver polyfill for JSDOM (required by Radix UI Switch, Popover, etc.)
global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
};

// Mock Better Auth React client
vi.mock('better-auth/react', () => {
    const mockSession = {
        user: {
            id: 'test_user_id',
            name: 'Test User',
            email: 'test@example.com',
            emailVerified: true,
            image: null,
            role: 'USER',
            createdAt: new Date(),
            updatedAt: new Date()
        },
        session: {
            id: 'test_session_id',
            userId: 'test_user_id',
            token: 'test-session-token',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
    };

    return {
        createAuthClient: vi.fn(() => ({
            useSession: vi.fn(() => ({
                data: mockSession,
                isPending: false,
                error: null
            })),
            signIn: {
                email: vi.fn().mockResolvedValue({ data: mockSession, error: null }),
                social: vi.fn().mockResolvedValue({})
            },
            signUp: {
                email: vi.fn().mockResolvedValue({ data: mockSession, error: null })
            },
            signOut: vi.fn().mockResolvedValue({}),
            getSession: vi.fn().mockResolvedValue(mockSession)
        }))
    };
});

// Mock TanStack Router
vi.mock('@tanstack/react-router', () => ({
    useRouter: () => ({
        navigate: vi.fn(),
        history: {
            push: vi.fn(),
            replace: vi.fn()
        }
    }),
    useNavigate: () => vi.fn(),
    useSearch: () => ({ page: 1, pageSize: 20 }),
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/', search: '', hash: '' }),
    useRouterState: () => ({ location: { pathname: '/', search: '', hash: '' } }),
    Link: ({ children, to, ...props }: Record<string, unknown>) => {
        return (
            <a
                href={to as string}
                {...props}
            >
                {children as React.ReactNode}
            </a>
        );
    },
    Outlet: () => null,
    createRouter: vi.fn(),
    createRoute: vi.fn(),
    createRootRoute: vi.fn(),
    createLazyFileRoute:
        (_path: string) =>
        (routeOptions: {
            component: React.ComponentType;
            pendingComponent?: React.ComponentType;
            [key: string]: unknown;
        }) => ({
            options: routeOptions
        }),
    createFileRoute:
        (_path: string) =>
        (routeOptions: {
            component: React.ComponentType;
            pendingComponent?: React.ComponentType;
            [key: string]: unknown;
        }) => ({
            options: routeOptions,
            useSearch: vi.fn(() => ({ page: 1, pageSize: 20 })),
            useParams: vi.fn(() => ({})),
            useLoaderData: vi.fn(() => null)
        })
}));

// Mock @qazuor/qzpay-react — gates always render children in tests
vi.mock('@qazuor/qzpay-react', () => ({
    LimitGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    LimitReachedUI: () => <div data-testid="limit-reached" />,
    EntitlementGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useEntitlements: () => ({ check: () => true, isLoading: false }),
    QZPayProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    qzpayMergeTheme: (base: Record<string, unknown>, overrides: Record<string, unknown>) => {
        const result = { ...base };
        for (const key of Object.keys(overrides)) {
            const baseVal = base[key];
            const overVal = overrides[key];
            if (
                baseVal &&
                typeof baseVal === 'object' &&
                !Array.isArray(baseVal) &&
                overVal &&
                typeof overVal === 'object' &&
                !Array.isArray(overVal)
            ) {
                result[key] = {
                    ...(baseVal as Record<string, unknown>),
                    ...(overVal as Record<string, unknown>)
                };
            } else {
                result[key] = overVal;
            }
        }
        return result;
    }
}));

// Global mock for @repo/icons using a plain object (no Proxy).
// Enumerates all icon names used across the admin app.
// NOTE: Do NOT use a Proxy as the vi.mock factory return value — it causes
// vitest's module registry to hang when traversing module dependencies.
vi.mock('@repo/icons', () => {
    const stub =
        (name: string) =>
        (props: Record<string, unknown>): React.ReactElement => (
            <span
                data-testid={`icon-${name}`}
                aria-hidden="true"
                {...props}
            />
        );
    return {
        // Size constants used by Icon.tsx
        ICON_SIZES: { xs: 12, sm: 16, md: 20, lg: 24, xl: 32, '2xl': 40 },
        // Entity icons
        AccommodationIcon: stub('AccommodationIcon'),
        DestinationIcon: stub('DestinationIcon'),
        EventIcon: stub('EventIcon'),
        EventLocationIcon: stub('EventLocationIcon'),
        EventOrganizerIcon: stub('EventOrganizerIcon'),
        PostIcon: stub('PostIcon'),
        PostSponsorIcon: stub('PostSponsorIcon'),
        // System icons
        ActivityIcon: stub('ActivityIcon'),
        AddIcon: stub('AddIcon'),
        AdminIcon: stub('AdminIcon'),
        AlertCircleIcon: stub('AlertCircleIcon'),
        AlertTriangleIcon: stub('AlertTriangleIcon'),
        AnalyticsIcon: stub('AnalyticsIcon'),
        BarChartIcon: stub('BarChartIcon'),
        BellIcon: stub('BellIcon'),
        BoldIcon: stub('BoldIcon'),
        BreadcrumbsIcon: stub('BreadcrumbsIcon'),
        BuildingIcon: stub('BuildingIcon'),
        CalendarIcon: stub('CalendarIcon'),
        CancelIcon: stub('CancelIcon'),
        ChatIcon: stub('ChatIcon'),
        CheckCircleIcon: stub('CheckCircleIcon'),
        CheckIcon: stub('CheckIcon'),
        CheckInIcon: stub('CheckInIcon'),
        CheckOutIcon: stub('CheckOutIcon'),
        ChevronDownIcon: stub('ChevronDownIcon'),
        ChevronLeftIcon: stub('ChevronLeftIcon'),
        ChevronRightIcon: stub('ChevronRightIcon'),
        ChevronsUpDownIcon: stub('ChevronsUpDownIcon'),
        ChevronUpIcon: stub('ChevronUpIcon'),
        CircleIcon: stub('CircleIcon'),
        ClockIcon: stub('ClockIcon'),
        CloseIcon: stub('CloseIcon'),
        ConfirmIcon: stub('ConfirmIcon'),
        ContentIcon: stub('ContentIcon'),
        CopyIcon: stub('CopyIcon'),
        CouponsIcon: stub('CouponsIcon'),
        CreditCardIcon: stub('CreditCardIcon'),
        DashboardIcon: stub('DashboardIcon'),
        DebugIcon: stub('DebugIcon'),
        DeleteIcon: stub('DeleteIcon'),
        DollarSignIcon: stub('DollarSignIcon'),
        DownloadIcon: stub('DownloadIcon'),
        DropdownIcon: stub('DropdownIcon'),
        EditIcon: stub('EditIcon'),
        EmailIcon: stub('EmailIcon'),
        ExportIcon: stub('ExportIcon'),
        ExternalLinkIcon: stub('ExternalLinkIcon'),
        EyeIcon: stub('EyeIcon'),
        EyeOffIcon: stub('EyeOffIcon'),
        FileTextIcon: stub('FileTextIcon'),
        FilterIcon: stub('FilterIcon'),
        FirstPageIcon: stub('FirstPageIcon'),
        FullscreenIcon: stub('FullscreenIcon'),
        GlobeIcon: stub('GlobeIcon'),
        GridIcon: stub('GridIcon'),
        GripVerticalIcon: stub('GripVerticalIcon'),
        HomeIcon: stub('HomeIcon'),
        ImageIcon: stub('ImageIcon'),
        ImportIcon: stub('ImportIcon'),
        InfoIcon: stub('InfoIcon'),
        ItalicIcon: stub('ItalicIcon'),
        LastPageIcon: stub('LastPageIcon'),
        LinkIcon: stub('LinkIcon'),
        ListIcon: stub('ListIcon'),
        ListOrderedIcon: stub('ListOrderedIcon'),
        LoaderIcon: stub('LoaderIcon'),
        LocationIcon: stub('LocationIcon'),
        MailIcon: stub('MailIcon'),
        MapIcon: stub('MapIcon'),
        MenuIcon: stub('MenuIcon'),
        MetricsIcon: stub('MetricsIcon'),
        MoreHorizontalIcon: stub('MoreHorizontalIcon'),
        MousePointerClickIcon: stub('MousePointerClickIcon'),
        NextIcon: stub('NextIcon'),
        NotificationIcon: stub('NotificationIcon'),
        OffersIcon: stub('OffersIcon'),
        PackageIcon: stub('PackageIcon'),
        PermissionsIcon: stub('PermissionsIcon'),
        PhoneIcon: stub('PhoneIcon'),
        PlayIcon: stub('PlayIcon'),
        PowerIcon: stub('PowerIcon'),
        PowerOffIcon: stub('PowerOffIcon'),
        PreviousIcon: stub('PreviousIcon'),
        PriceIcon: stub('PriceIcon'),
        PrintIcon: stub('PrintIcon'),
        PromotionsIcon: stub('PromotionsIcon'),
        ReceiptIcon: stub('ReceiptIcon'),
        RefreshIcon: stub('RefreshIcon'),
        ReportsIcon: stub('ReportsIcon'),
        RolesIcon: stub('RolesIcon'),
        RotateCcwIcon: stub('RotateCcwIcon'),
        SaveIcon: stub('SaveIcon'),
        SearchIcon: stub('SearchIcon'),
        SectionIcon: stub('SectionIcon'),
        SettingsIcon: stub('SettingsIcon'),
        ShareIcon: stub('ShareIcon'),
        ShieldAlertIcon: stub('ShieldAlertIcon'),
        ShieldIcon: stub('ShieldIcon'),
        SortIcon: stub('SortIcon'),
        StatisticsIcon: stub('StatisticsIcon'),
        TagsIcon: stub('TagsIcon'),
        TrendingUpIcon: stub('TrendingUpIcon'),
        UnderlineIcon: stub('UnderlineIcon'),
        UploadIcon: stub('UploadIcon'),
        UserIcon: stub('UserIcon'),
        UsersIcon: stub('UsersIcon'),
        UsersManagementIcon: stub('UsersManagementIcon'),
        UserSwitchIcon: stub('UserSwitchIcon'),
        ViewAllIcon: stub('ViewAllIcon'),
        WebhookIcon: stub('WebhookIcon'),
        XCircleIcon: stub('XCircleIcon'),
        ZoomInIcon: stub('ZoomInIcon')
    };
});

// Mock useTranslations — returns translation keys as-is for test assertions
vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string, _count: number) => key,
        locale: 'es'
    })
}));

// Mock RoutePermissionGuard — always renders children (guard tested separately)
vi.mock('@/components/auth/RoutePermissionGuard', () => ({
    RoutePermissionGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>
}));

// Mock useAuthContext — provides authenticated ADMIN user for page tests
vi.mock('@/hooks/use-auth-context', () => ({
    useAuthContext: () => ({
        user: {
            id: 'test_user_id',
            name: 'Test User',
            email: 'test@example.com',
            role: 'ADMIN'
        },
        isAuthenticated: true,
        isLoading: false
    })
}));
