/**
 * @file comparison-row-icons.ts
 * @description Semantic icon mapping for the plan comparison table rows (SPEC-299
 * OQ-6). Keyed by the stable `RowConfig.id` used in `PlanComparisonTable.astro`,
 * so a single entry covers a row whether it appears in the tourist groups or the
 * owner `asTourist` group. Extracted from the component to keep that file focused
 * on rendering and within the project's file-size budget.
 *
 * The values are decorative-only icons; the table renders them with `aria-hidden`
 * because the row label text already conveys meaning.
 */

import {
    AskToAiIcon,
    BarChartIcon,
    BellIcon,
    BookmarkIcon,
    BriefcaseIcon,
    CalendarIcon,
    ChatIcon,
    CheckCircleIcon,
    ClockIcon,
    ColumnIcon,
    CompassIcon,
    EditIcon,
    FavoriteIcon,
    FileTextIcon,
    GlobeIcon,
    HomeIcon,
    type IconProps,
    ImageIcon,
    ImportIcon,
    MegaphoneIcon,
    PaletteIcon,
    PhoneIcon,
    QuotesIcon,
    SearchIcon,
    ShieldIcon,
    SparkleIcon,
    StarIcon,
    TrendingUpIcon,
    VideoIcon,
    WhatsappIcon
} from '@repo/icons';
import type { ComponentType } from 'react';

/**
 * Row id → icon component. `undefined` for any unmapped id so the template guard
 * (`{RowIcon && ...}`) renders no icon instead of crashing.
 */
export const COMPARISON_ROW_ICONS: Record<string, ComponentType<IconProps> | undefined> = {
    // Tourist experience
    favorites: FavoriteIcon,
    collections: BookmarkIcon,
    reviews: StarIcon,
    recommendations: CompassIcon,
    compare: ColumnIcon,
    searchHistory: ClockIcon,
    alertsOffers: BellIcon,
    whatsappDisplay: WhatsappIcon,
    whatsappDirect: PhoneIcon,
    // Tourist AI
    aiSearch: SearchIcon,
    aiChat: ChatIcon,
    // Owner listing
    publish: HomeIcon,
    photos: ImageIcon,
    editInfo: EditIcon,
    respondReviews: QuotesIcon,
    basicStats: BarChartIcon,
    advancedStats: TrendingUpIcon,
    calendar: CalendarIcon,
    richDescription: FileTextIcon,
    video: VideoIcon,
    promotions: MegaphoneIcon,
    prioritySupport: ShieldIcon,
    featured: SparkleIcon,
    branding: PaletteIcon,
    verificationBadge: CheckCircleIcon,
    // Owner AI
    aiTextImprove: AskToAiIcon,
    aiTranslate: GlobeIcon,
    aiImport: ImportIcon,
    // Same icon as `aiChat` on purpose — distinct audiences, never co-rendered.
    aiChatOwner: ChatIcon,
    aiSupport: BriefcaseIcon
};
