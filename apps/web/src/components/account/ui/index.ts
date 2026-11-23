/**
 * Mi Cuenta component kit — public entry (HOS-2413).
 *
 * Named re-exports only. Each kit task adds its component here; pages and
 * layouts import from this module, never from a component file directly.
 * Rules and conventions: `./README.md`.
 *
 * @module components/account/ui
 */

export { AccountBar, type AccountBarProps } from './AccountBar';
export { AccountFooter, type AccountFooterProps } from './AccountFooter';
export { AccountSidebar, type AccountSidebarProps } from './AccountSidebar';
export { AccountToastRegion, type AccountToastRegionProps } from './AccountToastRegion';
export { Alert, type AlertProps, type AlertTone } from './Alert';
export {
    AsyncRegion,
    type AsyncRegionProps,
    type AsyncResult,
    settleAsync
} from './AsyncRegion';
export {
    AutoSaveChip,
    type AutoSaveChipProps,
    type AutoSaveStatus,
    formatSavedTime
} from './AutoSaveChip';
export {
    Avatar,
    type AvatarProps,
    type AvatarSize,
    avatarInitials,
    avatarPalette
} from './Avatar';
export {
    ACCOUNT_SHELL_TEMPLATES,
    type AccountShellTemplate,
    DEFAULT_ACCOUNT_SHELL_TEMPLATE,
    resolveShellTemplate
} from './account-shell-template';
export {
    buildSidebarView,
    type SidebarGroupView,
    type SidebarItemView,
    type SidebarView
} from './account-sidebar-view';
export { Button, type ButtonContentProps, type ButtonProps } from './Button';
export type { ButtonSize, ButtonVariant } from './button-class';
export { Checkbox, CheckboxGroup, type CheckboxGroupProps, type CheckboxProps } from './Checkbox';
export {
    type CompletenessItem,
    CompletenessMeter,
    type CompletenessMeterProps
} from './CompletenessMeter';
export { Composer, type ComposerProps } from './Composer';
export { ConfirmDialog, type ConfirmDialogProps, type ConfirmTone } from './ConfirmDialog';
export {
    ConversationThread,
    type ConversationThreadProps,
    formatMessageTime,
    type ThreadMessage,
    type ThreadViewer
} from './ConversationThread';
export { DataList, type DataListProps } from './DataList';
export { Dialog, type DialogProps, type DialogSize } from './Dialog';
export { Drawer, type DrawerProps, type DrawerSide } from './Drawer';
export { EditorSectionNav, type EditorSectionNavProps } from './EditorSectionNav';
export { EditorSwitcher, type EditorSwitcherProps } from './EditorSwitcher';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export {
    EntityCard,
    EntityCardGrid,
    type EntityCardGridProps,
    type EntityCardImage,
    type EntityCardProps
} from './EntityCard';
export { ErrorState, type ErrorStateProps } from './ErrorState';
export { Field, type FieldProps } from './Field';
export { type FieldContextValue, joinDescribedBy, useFieldControl } from './field-context';
export {
    copyHoursDayToAll,
    HOURS_DEFAULT_SLOT,
    HOURS_WEEKDAYS,
    type HoursBound,
    type HoursDay,
    HoursEditor,
    type HoursEditorProps,
    type HoursSlot,
    type HoursWeek,
    type HoursWeekday,
    removeHoursSlot,
    toggleHoursDay,
    weekdayName,
    withHoursDay
} from './HoursEditor';
export { type HelpAnchor, type HelpAttr, helpAttr, isHelpAnchor } from './help-anchor';
export { InputGroup, type InputGroupProps } from './InputGroup';
export { type KeyValueItem, KeyValueList, type KeyValueListProps } from './KeyValueList';
export { LinkButton, type LinkButtonProps } from './LinkButton';
export { ListRow, type ListRowActions, type ListRowProps } from './ListRow';
export { LockedState, type LockedStateProps } from './LockedState';
export type { LockReason, PlanRef } from './lock-reason';
export {
    MediaDropzone,
    type MediaDropzoneProps,
    MediaUploadStatus,
    type MediaUploadStatusProps,
    PhotoGrid,
    type PhotoGridProps,
    PhotoTile,
    type PhotoTileProps
} from './MediaManager';
export {
    MessageBubble,
    type MessageBubbleProps,
    type MessageBubbleSide,
    type MessageDelivery
} from './MessageBubble';
export { type Breadcrumb, PageHeader, type PageHeaderProps } from './PageHeader';
export { type LoadMoreResult, Pagination, type PaginationProps } from './Pagination';
export { PhoneField, type PhoneFieldProps } from './PhoneField';
export { buildPageRange, type PageSlot } from './pagination-range';
export { Radio, RadioGroup, type RadioGroupProps, type RadioProps } from './Radio';
export {
    Repeater,
    type RepeaterMoves,
    type RepeaterProps,
    type RepeaterRemoveConfirm
} from './Repeater';
export { Section, type SectionProps, type SectionVariant } from './Section';
export { Select, type SelectProps } from './Select';
export { Skeleton, type SkeletonProps, type SkeletonShape } from './Skeleton';
export {
    StatCard,
    type StatCardProps,
    StatGrid,
    type StatGridProps,
    type StatValue
} from './StatCard';
export { CountPill, type CountPillProps, StatusPill, type StatusPillProps } from './StatusPill';
export { StickySaveBar, type StickySaveBarProps } from './StickySaveBar';
export {
    Switch,
    type SwitchProps,
    SwitchRow,
    type SwitchRowLock,
    type SwitchRowProps
} from './Switch';
export { KitNestingError } from './section-depth-context';
export {
    STATUS_TONES,
    type StatusDomain,
    type StatusOf,
    type StatusTone,
    statusLabelKey,
    toneFor
} from './status-tone';
export {
    type NavTabItem,
    NavTabs,
    type NavTabsProps,
    type TabItem,
    Tabs,
    type TabsProps,
    type TabsVariant
} from './Tabs';
export { counterLevel, Textarea, type TextareaProps } from './Textarea';
export { TextInput, type TextInputProps } from './TextInput';
export { TextLink, type TextLinkProps, type TextLinkTone } from './TextLink';
export { Toast, type ToastProps, type ToastTone, toneForToast } from './Toast';
export { type ConfirmRequest, type UseConfirmResult, useConfirm } from './use-confirm';
export {
    SAVED_VISIBLE_MS,
    type SaveBarStatus,
    type SaveOutcome,
    type UseSaveBarOptions,
    type UseSaveBarResult,
    useSaveBar
} from './use-save-bar';
