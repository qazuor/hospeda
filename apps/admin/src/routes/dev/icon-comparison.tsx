/**
 * Icon Comparison Page - Development Tool
 *
 * Visual side-by-side comparison of current @repo/icons SVGs vs proposed Phosphor replacements.
 * Used to validate icon choices during SPEC-008 Phosphor Icons Migration.
 *
 * Route: /dev/icon-comparison
 */
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';

// ─── Current @repo/icons ───────────────────────────────────────────────────
import {
    // Entity
    AccommodationIcon,
    // Lucide-compat system icons
    ActivityIcon,
    // System icons
    AddIcon,
    AddressIcon,
    AdminIcon,
    AlertCircleIcon,
    AlertTriangleIcon,
    AlertsIcon,
    // Admin
    AnalyticsIcon,
    AudioIcon,
    BarChartIcon,
    BellIcon,
    BoldIcon,
    BuildingIcon,
    CalendarIcon,
    // Action icons
    CancelIcon,
    CheckCircleIcon,
    CheckIcon,
    ChevronDownIcon,
    ChevronRightIcon,
    ChevronUpIcon,
    ChevronsUpDownIcon,
    CircleIcon,
    CloseIcon,
    ConfigurationIcon,
    ConfirmIcon,
    CopyIcon,
    CreditCardIcon,
    DarkThemeIcon,
    DashboardIcon,
    DateIcon,
    DebugIcon,
    DeleteIcon,
    DestinationIcon,
    DocumentIcon,
    DollarSignIcon,
    DownloadIcon,
    DropdownIcon,
    EditIcon,
    // Communication
    EmailIcon,
    EventIcon,
    ExportIcon,
    ExternalLinkIcon,
    EyeIcon,
    EyeOffIcon,
    // Social
    FacebookIcon,
    FavoriteIcon,
    FileTextIcon,
    FilterIcon,
    FirstPageIcon,
    FullscreenIcon,
    GalleryIcon,
    GlobeIcon,
    GridIcon,
    GripVerticalIcon,
    HamburgerIcon,
    HomeIcon,
    ImageIcon,
    ImportIcon,
    InfoIcon,
    InstagramIcon,
    ItalicIcon,
    LastPageIcon,
    LightThemeIcon,
    LinkIcon,
    ListIcon,
    ListOrderedIcon,
    LoaderIcon,
    LocationIcon,
    LogoutIcon,
    MailIcon,
    MapIcon,
    MenuIcon,
    MetricsIcon,
    MinimizeIcon,
    MonitorIcon,
    MoonIcon,
    MoreHorizontalIcon,
    MousePointerClickIcon,
    NextIcon,
    NotificationIcon,
    PackageIcon,
    PaletteIcon,
    PdfIcon,
    PermissionIcon,
    PhoneIcon,
    PlayIcon,
    PostIcon,
    PowerIcon,
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
    SettingsIcon,
    ShareIcon,
    ShieldAlertIcon,
    ShieldIcon,
    ShoppingCartIcon,
    SortIcon,
    StarIcon,
    SunIcon,
    SynchronizeIcon,
    TagIcon,
    TrendingDownIcon,
    TrendingUpIcon,
    UnderlineIcon,
    UploadIcon,
    UserIcon,
    UsersIcon,
    VideoIcon,
    ViewAllIcon,
    WebhookIcon,
    WhatsappIcon,
    XCircleIcon,
    ZoomInIcon,
    ZoomOutIcon
} from '@repo/icons';

// ─── Phosphor Icons ────────────────────────────────────────────────────────
import {
    ArrowCounterClockwise as PhArrowCounterClockwise,
    // Chosen alternatives
    ArrowSquareIn as PhArrowSquareIn,
    ArrowSquareOut as PhArrowSquareOut,
    ArrowsClockwise as PhArrowsClockwise,
    ArrowsIn as PhArrowsIn,
    ArrowsOut as PhArrowsOut,
    Article as PhArticle,
    Bed as PhBed,
    Bell as PhBell,
    Bug as PhBug,
    Buildings as PhBuildings,
    Calendar as PhCalendar,
    CalendarBlank as PhCalendarBlank,
    CaretDoubleLeft as PhCaretDoubleLeft,
    CaretDoubleRight as PhCaretDoubleRight,
    CaretDown as PhCaretDown,
    CaretLeft as PhCaretLeft,
    CaretRight as PhCaretRight,
    CaretUp as PhCaretUp,
    CaretUpDown as PhCaretUpDown,
    ChartBar as PhChartBar,
    Check as PhCheck,
    CheckCircle as PhCheckCircle,
    Circle as PhCircle,
    Copy as PhCopy,
    CreditCard as PhCreditCard,
    CurrencyDollar as PhCurrencyDollar,
    CursorClick as PhCursorClick,
    DotsSixVertical as PhDotsSixVertical,
    DotsThree as PhDotsThree,
    DownloadSimple as PhDownloadSimple,
    Envelope as PhEnvelope,
    Export as PhExport,
    Eye as PhEye,
    EyeSlash as PhEyeSlash,
    FacebookLogo as PhFacebookLogo,
    FilePdf as PhFilePdf,
    FileText as PhFileText,
    FloppyDisk as PhFloppyDisk,
    Funnel as PhFunnel,
    Gear as PhGear,
    GearSix as PhGearSix,
    Globe as PhGlobe,
    GridFour as PhGridFour,
    Heart as PhHeart,
    House as PhHouse,
    Image as PhImage,
    Images as PhImages,
    Info as PhInfo,
    InstagramLogo as PhInstagramLogo,
    Key as PhKey,
    Link as PhLink,
    List as PhList,
    ListNumbers as PhListNumbers,
    MagnifyingGlass as PhMagnifyingGlass,
    MagnifyingGlassMinus as PhMagnifyingGlassMinus,
    MagnifyingGlassPlus as PhMagnifyingGlassPlus,
    MapPin as PhMapPin,
    MapTrifold as PhMapTrifold,
    Megaphone as PhMegaphone,
    Monitor as PhMonitor,
    Moon as PhMoon,
    Package as PhPackage,
    Palette as PhPalette,
    PencilSimple as PhPencilSimple,
    Phone as PhPhone,
    Play as PhPlay,
    Plus as PhPlus,
    Power as PhPower,
    Printer as PhPrinter,
    Prohibit as PhProhibit,
    Pulse as PhPulse,
    Receipt as PhReceipt,
    ShareNetwork as PhShareNetwork,
    Shield as PhShield,
    ShieldWarning as PhShieldWarning,
    ShoppingCart as PhShoppingCart,
    SignOut as PhSignOut,
    Signpost as PhSignpost,
    SortAscending as PhSortAscending,
    SpeakerHigh as PhSpeakerHigh,
    SpinnerGap as PhSpinnerGap,
    SquaresFour as PhSquaresFour,
    Star as PhStar,
    Sun as PhSun,
    Tag as PhTag,
    TextB as PhTextB,
    TextItalic as PhTextItalic,
    TextUnderline as PhTextUnderline,
    Ticket as PhTicket,
    Trash as PhTrash,
    TrendDown as PhTrendDown,
    TrendUp as PhTrendUp,
    UploadSimple as PhUploadSimple,
    User as PhUser,
    UserGear as PhUserGear,
    Users as PhUsers,
    VideoCamera as PhVideoCamera,
    Warning as PhWarning,
    WarningCircle as PhWarningCircle,
    WebhooksLogo as PhWebhooksLogo,
    WhatsappLogo as PhWhatsappLogo,
    X as PhX,
    XCircle as PhXCircle
} from '@phosphor-icons/react';

import type { IconWeight } from '@phosphor-icons/react';

// ─── Types ─────────────────────────────────────────────────────────────────

type IconMapping = {
    readonly name: string;
    readonly current: React.ComponentType<Record<string, unknown>>;
    readonly phosphor: React.ComponentType<Record<string, unknown>>;
    readonly phosphorName: string;
    readonly notes?: string;
};

type CategoryGroup = {
    readonly label: string;
    readonly icons: readonly IconMapping[];
};

// ─── Mapping Data ──────────────────────────────────────────────────────────

const ICON_CATEGORIES: readonly CategoryGroup[] = [
    {
        label: 'System - Navigation & Layout',
        icons: [
            { name: 'HomeIcon', current: HomeIcon, phosphor: PhHouse, phosphorName: 'House' },
            {
                name: 'SearchIcon',
                current: SearchIcon,
                phosphor: PhMagnifyingGlass,
                phosphorName: 'MagnifyingGlass'
            },
            { name: 'MenuIcon', current: MenuIcon, phosphor: PhList, phosphorName: 'List' },
            {
                name: 'HamburgerIcon',
                current: HamburgerIcon,
                phosphor: PhList,
                phosphorName: 'List'
            },
            { name: 'CloseIcon', current: CloseIcon, phosphor: PhX, phosphorName: 'X' },
            {
                name: 'NextIcon',
                current: NextIcon,
                phosphor: PhCaretRight,
                phosphorName: 'CaretRight'
            },
            {
                name: 'PreviousIcon',
                current: PreviousIcon,
                phosphor: PhCaretLeft,
                phosphorName: 'CaretLeft'
            },
            {
                name: 'FirstPageIcon',
                current: FirstPageIcon,
                phosphor: PhCaretDoubleLeft,
                phosphorName: 'CaretDoubleLeft'
            },
            {
                name: 'LastPageIcon',
                current: LastPageIcon,
                phosphor: PhCaretDoubleRight,
                phosphorName: 'CaretDoubleRight'
            },
            {
                name: 'ChevronDownIcon',
                current: ChevronDownIcon,
                phosphor: PhCaretDown,
                phosphorName: 'CaretDown'
            },
            {
                name: 'ChevronUpIcon',
                current: ChevronUpIcon,
                phosphor: PhCaretUp,
                phosphorName: 'CaretUp'
            },
            {
                name: 'ChevronRightIcon',
                current: ChevronRightIcon,
                phosphor: PhCaretRight,
                phosphorName: 'CaretRight'
            },
            {
                name: 'ChevronsUpDownIcon',
                current: ChevronsUpDownIcon,
                phosphor: PhCaretUpDown,
                phosphorName: 'CaretUpDown'
            },
            {
                name: 'DropdownIcon',
                current: DropdownIcon,
                phosphor: PhCaretDown,
                phosphorName: 'CaretDown'
            },
            {
                name: 'FullscreenIcon',
                current: FullscreenIcon,
                phosphor: PhArrowsOut,
                phosphorName: 'ArrowsOut'
            },
            {
                name: 'MinimizeIcon',
                current: MinimizeIcon,
                phosphor: PhArrowsIn,
                phosphorName: 'ArrowsIn'
            },
            {
                name: 'ExternalLinkIcon',
                current: ExternalLinkIcon,
                phosphor: PhArrowSquareOut,
                phosphorName: 'ArrowSquareOut'
            },
            {
                name: 'LocationIcon',
                current: LocationIcon,
                phosphor: PhMapPin,
                phosphorName: 'MapPin'
            },
            {
                name: 'MapIcon',
                current: MapIcon,
                phosphor: PhMapTrifold,
                phosphorName: 'MapTrifold'
            },
            { name: 'GlobeIcon', current: GlobeIcon, phosphor: PhGlobe, phosphorName: 'Globe' }
        ]
    },
    {
        label: 'System - Actions',
        icons: [
            { name: 'AddIcon', current: AddIcon, phosphor: PhPlus, phosphorName: 'Plus' },
            {
                name: 'EditIcon',
                current: EditIcon,
                phosphor: PhPencilSimple,
                phosphorName: 'PencilSimple'
            },
            { name: 'DeleteIcon', current: DeleteIcon, phosphor: PhTrash, phosphorName: 'Trash' },
            {
                name: 'SaveIcon',
                current: SaveIcon,
                phosphor: PhFloppyDisk,
                phosphorName: 'FloppyDisk'
            },
            {
                name: 'CancelIcon',
                current: CancelIcon,
                phosphor: PhProhibit,
                phosphorName: 'Prohibit'
            },
            { name: 'ConfirmIcon', current: ConfirmIcon, phosphor: PhCheck, phosphorName: 'Check' },
            { name: 'CopyIcon', current: CopyIcon, phosphor: PhCopy, phosphorName: 'Copy' },
            {
                name: 'ShareIcon',
                current: ShareIcon,
                phosphor: PhShareNetwork,
                phosphorName: 'ShareNetwork'
            },
            { name: 'PrintIcon', current: PrintIcon, phosphor: PhPrinter, phosphorName: 'Printer' },
            {
                name: 'DownloadIcon',
                current: DownloadIcon,
                phosphor: PhDownloadSimple,
                phosphorName: 'DownloadSimple'
            },
            {
                name: 'UploadIcon',
                current: UploadIcon,
                phosphor: PhUploadSimple,
                phosphorName: 'UploadSimple'
            },
            { name: 'ExportIcon', current: ExportIcon, phosphor: PhExport, phosphorName: 'Export' },
            {
                name: 'ImportIcon',
                current: ImportIcon,
                phosphor: PhArrowSquareIn,
                phosphorName: 'ArrowSquareIn'
            },
            {
                name: 'RefreshIcon',
                current: RefreshIcon,
                phosphor: PhArrowsClockwise,
                phosphorName: 'ArrowsClockwise'
            },
            {
                name: 'SynchronizeIcon',
                current: SynchronizeIcon,
                phosphor: PhArrowsClockwise,
                phosphorName: 'ArrowsClockwise'
            },
            {
                name: 'RotateCcwIcon',
                current: RotateCcwIcon,
                phosphor: PhArrowCounterClockwise,
                phosphorName: 'ArrowCounterClockwise'
            },
            {
                name: 'LoaderIcon',
                current: LoaderIcon,
                phosphor: PhSpinnerGap,
                phosphorName: 'SpinnerGap',
                notes: 'animate-spin via factory'
            },
            {
                name: 'SortIcon',
                current: SortIcon,
                phosphor: PhSortAscending,
                phosphorName: 'SortAscending'
            },
            { name: 'FilterIcon', current: FilterIcon, phosphor: PhFunnel, phosphorName: 'Funnel' },
            {
                name: 'ZoomInIcon',
                current: ZoomInIcon,
                phosphor: PhMagnifyingGlassPlus,
                phosphorName: 'MagnifyingGlassPlus'
            },
            {
                name: 'ZoomOutIcon',
                current: ZoomOutIcon,
                phosphor: PhMagnifyingGlassMinus,
                phosphorName: 'MagnifyingGlassMinus'
            }
        ]
    },
    {
        label: 'System - Status & Feedback',
        icons: [
            {
                name: 'AlertTriangleIcon',
                current: AlertTriangleIcon,
                phosphor: PhWarning,
                phosphorName: 'Warning'
            },
            {
                name: 'AlertCircleIcon',
                current: AlertCircleIcon,
                phosphor: PhWarningCircle,
                phosphorName: 'WarningCircle'
            },
            { name: 'CheckIcon', current: CheckIcon, phosphor: PhCheck, phosphorName: 'Check' },
            {
                name: 'CheckCircleIcon',
                current: CheckCircleIcon,
                phosphor: PhCheckCircle,
                phosphorName: 'CheckCircle'
            },
            {
                name: 'XCircleIcon',
                current: XCircleIcon,
                phosphor: PhXCircle,
                phosphorName: 'XCircle'
            },
            { name: 'InfoIcon', current: InfoIcon, phosphor: PhInfo, phosphorName: 'Info' },
            { name: 'CircleIcon', current: CircleIcon, phosphor: PhCircle, phosphorName: 'Circle' },
            {
                name: 'ActivityIcon',
                current: ActivityIcon,
                phosphor: PhPulse,
                phosphorName: 'Pulse'
            },
            {
                name: 'NotificationIcon',
                current: NotificationIcon,
                phosphor: PhBell,
                phosphorName: 'Bell'
            },
            { name: 'BellIcon', current: BellIcon, phosphor: PhBell, phosphorName: 'Bell' },
            { name: 'AlertsIcon', current: AlertsIcon, phosphor: PhBell, phosphorName: 'Bell' },
            { name: 'ShieldIcon', current: ShieldIcon, phosphor: PhShield, phosphorName: 'Shield' },
            {
                name: 'ShieldAlertIcon',
                current: ShieldAlertIcon,
                phosphor: PhShieldWarning,
                phosphorName: 'ShieldWarning'
            }
        ]
    },
    {
        label: 'System - Content & Data',
        icons: [
            {
                name: 'CalendarIcon',
                current: CalendarIcon,
                phosphor: PhCalendar,
                phosphorName: 'Calendar'
            },
            {
                name: 'DateIcon',
                current: DateIcon,
                phosphor: PhCalendarBlank,
                phosphorName: 'CalendarBlank'
            },
            {
                name: 'DocumentIcon',
                current: DocumentIcon,
                phosphor: PhFileText,
                phosphorName: 'FileText'
            },
            {
                name: 'FileTextIcon',
                current: FileTextIcon,
                phosphor: PhFileText,
                phosphorName: 'FileText'
            },
            { name: 'PdfIcon', current: PdfIcon, phosphor: PhFilePdf, phosphorName: 'FilePdf' },
            { name: 'ImageIcon', current: ImageIcon, phosphor: PhImage, phosphorName: 'Image' },
            {
                name: 'GalleryIcon',
                current: GalleryIcon,
                phosphor: PhImages,
                phosphorName: 'Images'
            },
            {
                name: 'VideoIcon',
                current: VideoIcon,
                phosphor: PhVideoCamera,
                phosphorName: 'VideoCamera'
            },
            {
                name: 'AudioIcon',
                current: AudioIcon,
                phosphor: PhSpeakerHigh,
                phosphorName: 'SpeakerHigh'
            },
            { name: 'LinkIcon', current: LinkIcon, phosphor: PhLink, phosphorName: 'Link' },
            { name: 'TagIcon', current: TagIcon, phosphor: PhTag, phosphorName: 'Tag' },
            { name: 'StarIcon', current: StarIcon, phosphor: PhStar, phosphorName: 'Star' },
            {
                name: 'FavoriteIcon',
                current: FavoriteIcon,
                phosphor: PhHeart,
                phosphorName: 'Heart'
            },
            { name: 'EyeIcon', current: EyeIcon, phosphor: PhEye, phosphorName: 'Eye' },
            {
                name: 'EyeOffIcon',
                current: EyeOffIcon,
                phosphor: PhEyeSlash,
                phosphorName: 'EyeSlash'
            },
            { name: 'GridIcon', current: GridIcon, phosphor: PhGridFour, phosphorName: 'GridFour' },
            {
                name: 'GripVerticalIcon',
                current: GripVerticalIcon,
                phosphor: PhDotsSixVertical,
                phosphorName: 'DotsSixVertical'
            },
            {
                name: 'MoreHorizontalIcon',
                current: MoreHorizontalIcon,
                phosphor: PhDotsThree,
                phosphorName: 'DotsThree'
            }
        ]
    },
    {
        label: 'System - Text Formatting',
        icons: [
            { name: 'BoldIcon', current: BoldIcon, phosphor: PhTextB, phosphorName: 'TextB' },
            {
                name: 'ItalicIcon',
                current: ItalicIcon,
                phosphor: PhTextItalic,
                phosphorName: 'TextItalic'
            },
            {
                name: 'UnderlineIcon',
                current: UnderlineIcon,
                phosphor: PhTextUnderline,
                phosphorName: 'TextUnderline'
            },
            {
                name: 'ListOrderedIcon',
                current: ListOrderedIcon,
                phosphor: PhListNumbers,
                phosphorName: 'ListNumbers'
            }
        ]
    },
    {
        label: 'System - Users & Auth',
        icons: [
            { name: 'UserIcon', current: UserIcon, phosphor: PhUser, phosphorName: 'User' },
            { name: 'UsersIcon', current: UsersIcon, phosphor: PhUsers, phosphorName: 'Users' },
            {
                name: 'AdminIcon',
                current: AdminIcon,
                phosphor: PhUserGear,
                phosphorName: 'UserGear'
            },
            {
                name: 'LogoutIcon',
                current: LogoutIcon,
                phosphor: PhSignOut,
                phosphorName: 'SignOut'
            },
            {
                name: 'PermissionIcon',
                current: PermissionIcon,
                phosphor: PhKey,
                phosphorName: 'Key'
            }
        ]
    },
    {
        label: 'System - Settings & Config',
        icons: [
            { name: 'SettingsIcon', current: SettingsIcon, phosphor: PhGear, phosphorName: 'Gear' },
            {
                name: 'ConfigurationIcon',
                current: ConfigurationIcon,
                phosphor: PhGearSix,
                phosphorName: 'GearSix'
            },
            { name: 'DebugIcon', current: DebugIcon, phosphor: PhBug, phosphorName: 'Bug' },
            {
                name: 'DarkThemeIcon',
                current: DarkThemeIcon,
                phosphor: PhMoon,
                phosphorName: 'Moon'
            },
            { name: 'MoonIcon', current: MoonIcon, phosphor: PhMoon, phosphorName: 'Moon' },
            {
                name: 'LightThemeIcon',
                current: LightThemeIcon,
                phosphor: PhSun,
                phosphorName: 'Sun'
            },
            { name: 'SunIcon', current: SunIcon, phosphor: PhSun, phosphorName: 'Sun' },
            {
                name: 'PaletteIcon',
                current: PaletteIcon,
                phosphor: PhPalette,
                phosphorName: 'Palette'
            },
            { name: 'PowerIcon', current: PowerIcon, phosphor: PhPower, phosphorName: 'Power' },
            {
                name: 'MonitorIcon',
                current: MonitorIcon,
                phosphor: PhMonitor,
                phosphorName: 'Monitor'
            },
            { name: 'PlayIcon', current: PlayIcon, phosphor: PhPlay, phosphorName: 'Play' },
            {
                name: 'MousePointerClickIcon',
                current: MousePointerClickIcon,
                phosphor: PhCursorClick,
                phosphorName: 'CursorClick'
            },
            {
                name: 'WebhookIcon',
                current: WebhookIcon,
                phosphor: PhWebhooksLogo,
                phosphorName: 'WebhooksLogo'
            }
        ]
    },
    {
        label: 'System - Commerce',
        icons: [
            {
                name: 'PriceIcon',
                current: PriceIcon,
                phosphor: PhCurrencyDollar,
                phosphorName: 'CurrencyDollar'
            },
            {
                name: 'DollarSignIcon',
                current: DollarSignIcon,
                phosphor: PhCurrencyDollar,
                phosphorName: 'CurrencyDollar'
            },
            {
                name: 'CreditCardIcon',
                current: CreditCardIcon,
                phosphor: PhCreditCard,
                phosphorName: 'CreditCard'
            },
            {
                name: 'ReceiptIcon',
                current: ReceiptIcon,
                phosphor: PhReceipt,
                phosphorName: 'Receipt'
            },
            {
                name: 'ShoppingCartIcon',
                current: ShoppingCartIcon,
                phosphor: PhShoppingCart,
                phosphorName: 'ShoppingCart'
            },
            {
                name: 'PackageIcon',
                current: PackageIcon,
                phosphor: PhPackage,
                phosphorName: 'Package'
            }
        ]
    },
    {
        label: 'System - Charts & Analytics',
        icons: [
            {
                name: 'BarChartIcon',
                current: BarChartIcon,
                phosphor: PhChartBar,
                phosphorName: 'ChartBar'
            },
            {
                name: 'TrendingUpIcon',
                current: TrendingUpIcon,
                phosphor: PhTrendUp,
                phosphorName: 'TrendUp'
            },
            {
                name: 'TrendingDownIcon',
                current: TrendingDownIcon,
                phosphor: PhTrendDown,
                phosphorName: 'TrendDown'
            },
            {
                name: 'AnalyticsIcon',
                current: AnalyticsIcon,
                phosphor: PhChartBar,
                phosphorName: 'ChartBar'
            },
            { name: 'MetricsIcon', current: MetricsIcon, phosphor: PhPulse, phosphorName: 'Pulse' }
        ]
    },
    {
        label: 'Admin Navigation',
        icons: [
            {
                name: 'DashboardIcon',
                current: DashboardIcon,
                phosphor: PhSquaresFour,
                phosphorName: 'SquaresFour'
            },
            { name: 'ListIcon', current: ListIcon, phosphor: PhList, phosphorName: 'List' },
            {
                name: 'ReportsIcon',
                current: ReportsIcon,
                phosphor: PhFileText,
                phosphorName: 'FileText'
            },
            { name: 'RolesIcon', current: RolesIcon, phosphor: PhShield, phosphorName: 'Shield' },
            { name: 'ViewAllIcon', current: ViewAllIcon, phosphor: PhEye, phosphorName: 'Eye' }
        ]
    },
    {
        label: 'Communication & Social',
        icons: [
            { name: 'MailIcon', current: MailIcon, phosphor: PhEnvelope, phosphorName: 'Envelope' },
            {
                name: 'EmailIcon',
                current: EmailIcon,
                phosphor: PhEnvelope,
                phosphorName: 'Envelope'
            },
            { name: 'PhoneIcon', current: PhoneIcon, phosphor: PhPhone, phosphorName: 'Phone' },
            {
                name: 'FacebookIcon',
                current: FacebookIcon,
                phosphor: PhFacebookLogo,
                phosphorName: 'FacebookLogo'
            },
            {
                name: 'InstagramIcon',
                current: InstagramIcon,
                phosphor: PhInstagramLogo,
                phosphorName: 'InstagramLogo'
            },
            {
                name: 'WhatsappIcon',
                current: WhatsappIcon,
                phosphor: PhWhatsappLogo,
                phosphorName: 'WhatsappLogo'
            }
        ]
    },
    {
        label: 'Entity Icons',
        icons: [
            {
                name: 'AccommodationIcon',
                current: AccommodationIcon,
                phosphor: PhBed,
                phosphorName: 'Bed'
            },
            {
                name: 'DestinationIcon',
                current: DestinationIcon,
                phosphor: PhSignpost,
                phosphorName: 'Signpost'
            },
            { name: 'EventIcon', current: EventIcon, phosphor: PhTicket, phosphorName: 'Ticket' },
            { name: 'PostIcon', current: PostIcon, phosphor: PhArticle, phosphorName: 'Article' },
            {
                name: 'PromotionsIcon',
                current: PromotionsIcon,
                phosphor: PhMegaphone,
                phosphorName: 'Megaphone'
            },
            {
                name: 'BuildingIcon',
                current: BuildingIcon,
                phosphor: PhBuildings,
                phosphorName: 'Buildings'
            },
            {
                name: 'AddressIcon',
                current: AddressIcon,
                phosphor: PhMapPin,
                phosphorName: 'MapPin'
            }
        ]
    }
] as const;

const WEIGHTS: readonly IconWeight[] = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone'];

// ─── Components ────────────────────────────────────────────────────────────

function IconCell({
    children,
    label
}: {
    readonly children: React.ReactNode;
    readonly label?: string;
}) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                {children}
            </div>
            {label ? <span className="text-[10px] text-gray-400">{label}</span> : null}
        </div>
    );
}

function CategorySection({
    group,
    iconSize,
    duotoneColor
}: {
    readonly group: CategoryGroup;
    readonly iconSize: number;
    readonly duotoneColor: string;
}) {
    return (
        <div className="mb-8">
            <h2 className="mb-3 border-gray-200 border-b pb-2 font-semibold text-lg dark:border-gray-700">
                {group.label}
                <span className="ml-2 font-normal text-gray-400 text-sm">
                    ({group.icons.length} icons)
                </span>
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-gray-200 border-b text-left text-gray-500 text-xs dark:border-gray-700">
                            <th className="sticky left-0 z-10 bg-white pr-4 pb-2 font-medium dark:bg-gray-950">
                                @repo/icons name
                            </th>
                            <th className="pr-4 pb-2 font-medium">Current SVG</th>
                            {WEIGHTS.map((w) => (
                                <th
                                    key={w}
                                    className="pr-2 pb-2 text-center font-medium"
                                >
                                    {w}
                                </th>
                            ))}
                            <th className="pr-4 pb-2 font-medium">Phosphor name</th>
                            <th className="pb-2 font-medium">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {group.icons.map((mapping) => {
                            const CurrentIcon = mapping.current;
                            const PhIcon = mapping.phosphor;
                            return (
                                <tr
                                    key={mapping.name}
                                    className="border-gray-100 border-b hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                                >
                                    <td className="sticky left-0 z-10 bg-white py-2 pr-4 font-mono text-xs dark:bg-gray-950">
                                        {mapping.name}
                                    </td>
                                    <td className="py-2 pr-4">
                                        <IconCell>
                                            <CurrentIcon size={iconSize} />
                                        </IconCell>
                                    </td>
                                    {WEIGHTS.map((w) => (
                                        <td
                                            key={w}
                                            className="py-2 pr-2"
                                        >
                                            <IconCell label={w}>
                                                <PhIcon
                                                    size={iconSize}
                                                    weight={w}
                                                    {...(w === 'duotone'
                                                        ? { color: duotoneColor }
                                                        : {})}
                                                />
                                            </IconCell>
                                        </td>
                                    ))}
                                    <td className="py-2 pr-4 font-mono text-cyan-600 text-xs">
                                        {mapping.phosphorName}
                                    </td>
                                    <td className="py-2 text-gray-400 text-xs">
                                        {mapping.notes || '-'}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────

function IconComparisonPage() {
    const [iconSize, setIconSize] = useState(24);
    const [searchQuery, setSearchQuery] = useState('');
    const [duotoneColor, setDuotoneColor] = useState('#0891b2');

    const filteredCategories = searchQuery
        ? ICON_CATEGORIES.map((cat) => ({
              ...cat,
              icons: cat.icons.filter(
                  (icon) =>
                      icon.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      icon.phosphorName.toLowerCase().includes(searchQuery.toLowerCase())
              )
          })).filter((cat) => cat.icons.length > 0)
        : ICON_CATEGORIES;

    const totalIcons = ICON_CATEGORIES.reduce((acc, cat) => acc + cat.icons.length, 0);
    const filteredCount = filteredCategories.reduce((acc, cat) => acc + cat.icons.length, 0);

    return (
        <div className="mx-auto max-w-[1800px] p-6">
            <div className="mb-6">
                <h1 className="font-bold text-2xl">Icon Comparison: @repo/icons vs Phosphor</h1>
                <p className="mt-1 text-gray-500 text-sm">
                    SPEC-008 Migration Tool .. {totalIcons} icons mapped across{' '}
                    {ICON_CATEGORIES.length} categories .. Showing all 6 Phosphor weights per icon
                </p>
            </div>

            {/* Controls */}
            <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
                <div className="flex items-center gap-2">
                    <label
                        htmlFor="search-input"
                        className="font-medium text-sm"
                    >
                        Search:
                    </label>
                    <input
                        id="search-input"
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Filter icons..."
                        className="rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-gray-600 dark:bg-gray-800"
                    />
                    {searchQuery ? (
                        <span className="text-gray-400 text-xs">
                            {filteredCount}/{totalIcons}
                        </span>
                    ) : null}
                </div>

                <div className="flex items-center gap-2">
                    <label
                        htmlFor="size-select"
                        className="font-medium text-sm"
                    >
                        Size:
                    </label>
                    <select
                        id="size-select"
                        value={iconSize}
                        onChange={(e) => setIconSize(Number(e.target.value))}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800"
                    >
                        <option value={16}>16px (xs)</option>
                        <option value={20}>20px (sm)</option>
                        <option value={24}>24px (md)</option>
                        <option value={28}>28px (lg)</option>
                        <option value={32}>32px (xl)</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label
                        htmlFor="duotone-color"
                        className="font-medium text-sm"
                    >
                        Duotone color:
                    </label>
                    <input
                        id="duotone-color"
                        type="color"
                        value={duotoneColor}
                        onChange={(e) => setDuotoneColor(e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border border-gray-300 p-0.5 dark:border-gray-600"
                    />
                    <span className="font-mono text-gray-400 text-xs">{duotoneColor}</span>
                </div>
            </div>

            {/* Categories */}
            {filteredCategories.map((group) => (
                <CategorySection
                    key={group.label}
                    group={group}
                    iconSize={iconSize}
                    duotoneColor={duotoneColor}
                />
            ))}

            {filteredCategories.length === 0 ? (
                <div className="py-12 text-center text-gray-400">
                    No icons match &quot;{searchQuery}&quot;
                </div>
            ) : null}
        </div>
    );
}

// ─── Route ─────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/dev/icon-comparison')({
    component: IconComparisonPage
});
