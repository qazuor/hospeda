import { createBrandIcon } from '../../create-brand-icon';

/**
 * X (formerly Twitter) brand mark.
 *
 * Source: simpleicons.org (`x`) — official single-color silhouette of the
 * post-rebrand logo. Exported as both `XIcon` (preferred, current brand
 * name) and `TwitterIcon` (legacy alias kept for backwards compatibility
 * with existing imports).
 */
export const XIcon = createBrandIcon(
    <path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z" />,
    'X'
);

export const TwitterIcon = XIcon;
