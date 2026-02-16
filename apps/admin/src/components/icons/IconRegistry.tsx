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
    // System icons
    ActivityIcon,
    AddIcon,
    AdminIcon,
    AlertCircleIcon,
    AlertTriangleIcon,
    AnalyticsIcon,
    BarChartIcon,
    BellIcon,
    BoldIcon,
    BreadcrumbsIcon,
    BuildingIcon,
    // Booking
    CalendarIcon,
    CancelIcon,
    ChatIcon,
    CheckCircleIcon,
    CheckIcon,
    CheckInIcon,
    CheckOutIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ChevronUpIcon,
    ChevronsUpDownIcon,
    CircleIcon,
    ClockIcon,
    CloseIcon,
    ConfirmIcon,
    ContentIcon,
    // Actions
    CopyIcon,
    CouponsIcon,
    CreditCardIcon,
    // Admin icons
    DashboardIcon,
    DebugIcon,
    DeleteIcon,
    DestinationIcon,
    DollarSignIcon,
    DownloadIcon,
    DropdownIcon,
    EditIcon,
    // Communication
    EmailIcon,
    EventIcon,
    EventLocationIcon,
    EventOrganizerIcon,
    ExportIcon,
    ExternalLinkIcon,
    EyeIcon,
    EyeOffIcon,
    FileTextIcon,
    FilterIcon,
    FirstPageIcon,
    FullscreenIcon,
    GlobeIcon,
    GridIcon,
    GripVerticalIcon,
    // System icons commonly used in admin
    HomeIcon,
    ImageIcon,
    ImportIcon,
    InfoIcon,
    ItalicIcon,
    LastPageIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    LoaderIcon,
    MailIcon,
    MapIcon,
    MenuIcon,
    MetricsIcon,
    MoreHorizontalIcon,
    MousePointerClickIcon,
    // Navigation
    NextIcon,
    NotificationIcon,
    OffersIcon,
    PackageIcon,
    PermissionsIcon,
    PhoneIcon,
    PostIcon,
    PostSponsorIcon,
    PowerIcon,
    PowerOffIcon,
    PreviousIcon,
    PriceIcon,
    PrintIcon,
    PromotionsIcon,
    ReceiptIcon,
    RefreshIcon,
    ReportsIcon,
    RolesIcon,
    RotateCcwIcon,
    SaveIcon,
    SearchIcon,
    SectionIcon,
    SettingsIcon,
    ShareIcon,
    ShieldAlertIcon,
    ShieldIcon,
    SortIcon,
    StatisticsIcon,
    TagsIcon,
    TrendingUpIcon,
    UnderlineIcon,
    UploadIcon,
    UserIcon,
    UsersIcon,
    UsersManagementIcon,
    ViewAllIcon,
    WebhookIcon,
    XCircleIcon,
    ZoomInIcon
} from '@repo/icons';

/**
 * Icon registry mapping icon names to components
 */
export const ICON_REGISTRY = {
    // System icons
    add: AddIcon,
    admin: AdminIcon,
    'alert-triangle': AlertTriangleIcon,
    cancel: CancelIcon,
    close: CloseIcon,
    confirm: ConfirmIcon,
    delete: DeleteIcon,
    download: DownloadIcon,
    edit: EditIcon,
    export: ExportIcon,
    filter: FilterIcon,
    home: HomeIcon,
    import: ImportIcon,
    loader: LoaderIcon,
    menu: MenuIcon,
    refresh: RefreshIcon,
    save: SaveIcon,
    search: SearchIcon,
    settings: SettingsIcon,
    sort: SortIcon,
    upload: UploadIcon,
    user: UserIcon,
    users: UsersIcon,

    // Entity icons
    accommodation: AccommodationIcon,
    content: ContentIcon,
    coupons: CouponsIcon,
    destination: DestinationIcon,
    event: EventIcon,
    'event-location': EventLocationIcon,
    'event-organizer': EventOrganizerIcon,
    offers: OffersIcon,
    post: PostIcon,
    'post-sponsor': PostSponsorIcon,
    promotions: PromotionsIcon,
    section: SectionIcon,

    // Admin icons
    analytics: AnalyticsIcon,
    dashboard: DashboardIcon,
    debug: DebugIcon,
    metrics: MetricsIcon,
    permissions: PermissionsIcon,
    reports: ReportsIcon,
    roles: RolesIcon,
    statistics: StatisticsIcon,
    tags: TagsIcon,
    'users-management': UsersManagementIcon,
    'view-all': ViewAllIcon,

    // Actions
    copy: CopyIcon,
    print: PrintIcon,
    'rotate-ccw': RotateCcwIcon,
    share: ShareIcon,

    // Communication
    chat: ChatIcon,
    email: EmailIcon,
    mail: MailIcon,
    notification: NotificationIcon,
    phone: PhoneIcon,

    // Booking
    calendar: CalendarIcon,
    'check-in': CheckInIcon,
    'check-out': CheckOutIcon,

    // Navigation
    breadcrumbs: BreadcrumbsIcon,
    'chevron-down': ChevronDownIcon,
    'chevron-right': ChevronRightIcon,
    'chevron-up': ChevronUpIcon,
    'chevrons-up-down': ChevronsUpDownIcon,
    dropdown: DropdownIcon,
    'external-link': ExternalLinkIcon,
    'first-page': FirstPageIcon,
    fullscreen: FullscreenIcon,
    'last-page': LastPageIcon,
    next: NextIcon,
    previous: PreviousIcon,
    'zoom-in': ZoomInIcon,

    // UI Controls
    activity: ActivityIcon,
    bell: BellIcon,
    circle: CircleIcon,
    clock: ClockIcon,
    grid: GridIcon,
    'grip-vertical': GripVerticalIcon,
    list: ListIcon,
    'more-horizontal': MoreHorizontalIcon,
    'mouse-pointer-click': MousePointerClickIcon,

    // Status and Feedback
    'alert-circle': AlertCircleIcon,
    check: CheckIcon,
    'check-circle': CheckCircleIcon,
    eye: EyeIcon,
    'eye-off': EyeOffIcon,
    info: InfoIcon,
    'x-circle': XCircleIcon,

    // Financial
    'credit-card': CreditCardIcon,
    'dollar-sign': DollarSignIcon,
    price: PriceIcon,
    receipt: ReceiptIcon,

    // Media and Rich Text
    bold: BoldIcon,
    'file-text': FileTextIcon,
    image: ImageIcon,
    italic: ItalicIcon,
    link: LinkIcon,
    'list-ordered': ListOrderedIcon,
    underline: UnderlineIcon,

    // Security
    shield: ShieldIcon,
    'shield-alert': ShieldAlertIcon,

    // Navigation and Maps
    globe: GlobeIcon,
    map: MapIcon,

    // System/Business
    'bar-chart': BarChartIcon,
    building: BuildingIcon,
    package: PackageIcon,
    power: PowerIcon,
    'power-off': PowerOffIcon,
    'trending-up': TrendingUpIcon,
    webhook: WebhookIcon
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
