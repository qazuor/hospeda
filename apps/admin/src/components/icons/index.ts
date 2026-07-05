/**
 * @file Icons Module Index
 *
 * This module provides centralized icon management for the admin application.
 * It exports the dynamic Icon component and utilities for icon management.
 */

// Re-export package icon sizes (pixel values) for reference
// Re-export commonly used icons for direct import when needed
export {
    AddIcon,
    AlertTriangleIcon,
    CancelIcon,
    CloseIcon,
    ConfirmIcon,
    DeleteIcon,
    EditIcon,
    HomeIcon,
    ICON_SIZES,
    LoaderIcon,
    MenuIcon,
    SaveIcon,
    SearchIcon,
    SettingsIcon,
    UserIcon,
    UsersIcon
} from '@repo/icons';
export type { IconProps } from './Icon';
// Export the main Icon component
// Export icon size classes for external use
export { ICON_SIZE_CLASSES, Icon } from './Icon';
export type { IconName } from './IconRegistry';
// Export icon registry utilities
export { FallbackIcon, getAvailableIcons, getIcon, hasIcon, ICON_REGISTRY } from './IconRegistry';
