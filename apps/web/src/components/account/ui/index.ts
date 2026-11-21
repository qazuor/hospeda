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
    buildSidebarView,
    type SidebarGroupView,
    type SidebarItemView,
    type SidebarView
} from './account-sidebar-view';
export { Button, type ButtonContentProps, type ButtonProps } from './Button';
export type { ButtonSize, ButtonVariant } from './button-class';
export { Checkbox, CheckboxGroup, type CheckboxGroupProps, type CheckboxProps } from './Checkbox';
export { ConfirmDialog, type ConfirmDialogProps, type ConfirmTone } from './ConfirmDialog';
export { Dialog, type DialogProps, type DialogSize } from './Dialog';
export { Drawer, type DrawerProps, type DrawerSide } from './Drawer';
export { EmptyState, type EmptyStateProps } from './EmptyState';
export { ErrorState, type ErrorStateProps } from './ErrorState';
export { Field, type FieldProps } from './Field';
export { type FieldContextValue, joinDescribedBy, useFieldControl } from './field-context';
export { type HelpAnchor, type HelpAttr, helpAttr, isHelpAnchor } from './help-anchor';
export { InputGroup, type InputGroupProps } from './InputGroup';
export { LinkButton, type LinkButtonProps } from './LinkButton';
export { LockedState, type LockedStateProps } from './LockedState';
export type { LockReason, PlanRef } from './lock-reason';
export { type LoadMoreResult, Pagination, type PaginationProps } from './Pagination';
export { PhoneField, type PhoneFieldProps } from './PhoneField';
export { buildPageRange, type PageSlot } from './pagination-range';
export { Radio, RadioGroup, type RadioGroupProps, type RadioProps } from './Radio';
export { Section, type SectionProps, type SectionVariant } from './Section';
export { Select, type SelectProps } from './Select';
export { Skeleton, type SkeletonProps, type SkeletonShape } from './Skeleton';
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
export { type ConfirmRequest, type UseConfirmResult, useConfirm } from './use-confirm';
export {
    SAVED_VISIBLE_MS,
    type SaveBarStatus,
    type SaveOutcome,
    type UseSaveBarOptions,
    type UseSaveBarResult,
    useSaveBar
} from './use-save-bar';
