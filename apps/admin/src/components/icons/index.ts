/**
 * @file Icons Module Index
 *
 * This module provides centralized icon management for the admin application.
 * It exports the dynamic Icon component and utilities for icon management.
 */

// Export the main Icon component
export { Icon } from './Icon';
export type { IconProps } from './Icon';

// Export icon registry utilities
export { FallbackIcon, getAvailableIcons, getIcon, hasIcon, ICON_REGISTRY } from './IconRegistry';
export type { IconName } from './IconRegistry';

// Export icon sizes for external use
export { ICON_SIZES } from './Icon';

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
    LoaderIcon,
    MenuIcon,
    SaveIcon,
    SearchIcon,
    SettingsIcon,
    UserIcon,
    UsersIcon
} from '@repo/icons';
