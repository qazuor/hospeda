/**
 * @file Icon Registry System
 *
 * This system provides centralized icon management with:
 * - Dynamic icon loading from @repo/icons
 * - Type-safe icon names
 * - Fallback handling for missing icons
 * - Consistent sizing and styling
 */

import {
    // Entity icons
    AccommodationIcon,
    AddIcon,
    AlertTriangleIcon,
    AnalyticsIcon,
    // Booking
    CalendarIcon,
    CancelIcon,
    ChatIcon,
    CheckInIcon,
    CheckOutIcon,
    CloseIcon,
    ConfirmIcon,
    // Actions
    CopyIcon,
    // Admin icons
    DashboardIcon,
    DeleteIcon,
    DestinationIcon,
    DownloadIcon,
    EditIcon,
    // Communication
    EmailIcon,
    EventIcon,
    ExportIcon,
    FilterIcon,
    FirstPageIcon,
    // System icons commonly used in admin
    HomeIcon,
    ImportIcon,
    LastPageIcon,
    LoaderIcon,
    MenuIcon,
    // Navigation
    NextIcon,
    PermissionsIcon,
    PhoneIcon,
    PostIcon,
    PreviousIcon,
    PrintIcon,
    RefreshIcon,
    ReportsIcon,
    RolesIcon,
    SaveIcon,
    SearchIcon,
    SettingsIcon,
    ShareIcon,
    SortIcon,
    TagsIcon,
    UploadIcon,
    UserIcon,
    UsersIcon
} from '@repo/icons';

/**
 * Icon registry mapping icon names to components
 */
export const ICON_REGISTRY = {
    // System icons
    home: HomeIcon,
    settings: SettingsIcon,
    user: UserIcon,
    users: UsersIcon,
    search: SearchIcon,
    edit: EditIcon,
    delete: DeleteIcon,
    add: AddIcon,
    save: SaveIcon,
    cancel: CancelIcon,
    confirm: ConfirmIcon,
    loader: LoaderIcon,
    'alert-triangle': AlertTriangleIcon,
    close: CloseIcon,
    menu: MenuIcon,
    filter: FilterIcon,
    sort: SortIcon,
    refresh: RefreshIcon,
    download: DownloadIcon,
    upload: UploadIcon,
    export: ExportIcon,
    import: ImportIcon,

    // Entity icons
    accommodation: AccommodationIcon,
    destination: DestinationIcon,
    event: EventIcon,
    post: PostIcon,

    // Admin icons
    dashboard: DashboardIcon,
    analytics: AnalyticsIcon,
    reports: ReportsIcon,
    permissions: PermissionsIcon,
    roles: RolesIcon,
    tags: TagsIcon,

    // Actions
    copy: CopyIcon,
    share: ShareIcon,
    print: PrintIcon,

    // Communication
    email: EmailIcon,
    phone: PhoneIcon,
    chat: ChatIcon,

    // Booking
    calendar: CalendarIcon,
    'check-in': CheckInIcon,
    'check-out': CheckOutIcon,

    // Navigation
    next: NextIcon,
    previous: PreviousIcon,
    'first-page': FirstPageIcon,
    'last-page': LastPageIcon
} as const;

/**
 * Type for available icon names
 */
export type IconName = keyof typeof ICON_REGISTRY;

/**
 * Get all available icon names
 */
export const getAvailableIcons = (): IconName[] => {
    return Object.keys(ICON_REGISTRY) as IconName[];
};

/**
 * Check if an icon exists in the registry
 */
export const hasIcon = (name: string): name is IconName => {
    return name in ICON_REGISTRY;
};

/**
 * Get icon component by name
 */
export const getIcon = (name: IconName) => {
    return ICON_REGISTRY[name];
};

/**
 * Default fallback icon for missing icons
 */
export const FallbackIcon = AlertTriangleIcon;
