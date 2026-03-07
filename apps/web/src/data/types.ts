/**
 * @file types.ts
 * @description Type definitions for static data used across the web app homepage.
 * Covers hero images, filter chips, reviews, stats, and navigation.
 */
import type { IconProps } from '@repo/icons';
import type React from 'react';

/** React component type compatible with @repo/icons icon components */
type Icon = React.ComponentType<IconProps>;

/** Single image slide for the hero section CSS-only carousel */
export interface HeroImage {
    /** Image source URL (relative to public directory) */
    readonly src: string;
    /** Accessible alt text describing the image */
    readonly alt: string;
}

/**
 * Filter chip data for accommodation type selection.
 * Rendered as clickable pills in the AccommodationsSection filter zone.
 */
export interface AccommodationType {
    /** Unique identifier for the accommodation type */
    readonly id: string;
    /** Display label for the filter chip */
    readonly name: string;
    /** Icon component rendered inside the chip */
    readonly icon: Icon;
    /** Query string parameter for filtering (e.g. "tipo=hotel") */
    readonly filter: string;
}

/**
 * Filter chip data for amenity selection.
 * Rendered as clickable pills in the AccommodationsSection filter zone.
 */
export interface Amenity {
    /** Unique identifier for the amenity */
    readonly id: string;
    /** Display label for the filter chip */
    readonly name: string;
    /** Icon component rendered inside the chip */
    readonly icon: Icon;
    /** Query string parameter for filtering (e.g. "amenity=wifi") */
    readonly filter: string;
}

/**
 * Guest review with rating and associated accommodation reference.
 * Displayed as testimonial cards in the ReviewsSection.
 */
export interface Review {
    /** Reviewer display name */
    readonly name: string;
    /** Reviewer city or origin */
    readonly location: string;
    /** Review text content */
    readonly text: string;
    /** Star rating (1-5) */
    readonly rating: number;
    /** Name of the reviewed accommodation */
    readonly accommodation: string;
}

/**
 * Platform statistic card data for the StatsSection.
 * Each stat displays an icon, numeric value, label, and description.
 */
export interface Stat {
    /** Icon component for the stat card */
    readonly icon: Icon;
    /** Numeric value string (e.g. "120+", "4.8") */
    readonly value: string;
    /** Short label (e.g. "Accommodations") */
    readonly label: string;
    /** Contextual description below the label */
    readonly description: string;
}

/**
 * Navigation link for the navbar with dual anchor/path support.
 * Anchors enable smooth scrolling on the homepage, paths enable
 * full page navigation from other routes.
 */
export interface NavLink {
    /** i18n key for the link label (e.g. "nav.accommodations") */
    readonly labelKey: string;
    /** Fallback label if i18n key is missing */
    readonly label: string;
    /** Anchor for same-page scrolling on the homepage (e.g. "#accommodations") */
    readonly anchor: string;
    /** Route path segment for full navigation (e.g. "alojamientos") */
    readonly path: string;
}

/**
 * Footer link item with i18n key and route path.
 * Used within footer columns for site-wide navigation.
 */
export interface FooterLink {
    /** i18n key for the link label */
    readonly labelKey: string;
    /** Fallback label if i18n key is missing */
    readonly label: string;
    /** Route path segment (e.g. "alojamientos") or empty for unlinked items */
    readonly path: string;
}

/**
 * Footer link columns keyed by section name.
 * Each key represents a column header, mapping to an array of links.
 */
export interface FooterLinks {
    readonly [column: string]: readonly FooterLink[];
}
