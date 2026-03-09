/**
 * @repo/feedback - FeedbackFAB inline style definitions.
 *
 * Extracted from FeedbackFAB.tsx to keep the component file under
 * the 500-line limit. All styles are FAB-specific and not shared
 * with other components.
 */
import type React from 'react';

/** Shared base properties for all FAB button states. */
export const FAB_BASE: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: 9998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    border: 'none',
    transition: 'box-shadow 0.2s ease, transform 0.2s ease'
};

/** Full-size FAB button (not minimized). */
export const FAB_FULL: React.CSSProperties = {
    ...FAB_BASE,
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.45), 0 2px 6px rgba(0, 0, 0, 0.2)'
};

/** Minimized FAB dot (idle state). */
export const FAB_MINIMIZED: React.CSSProperties = {
    ...FAB_BASE,
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#93c5fd',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)'
};

/** Minimized FAB dot on hover (expands to full size). */
export const FAB_MINIMIZED_HOVERED: React.CSSProperties = {
    ...FAB_MINIMIZED,
    width: '48px',
    height: '48px',
    backgroundColor: '#2563eb',
    color: '#ffffff',
    boxShadow: '0 4px 16px rgba(37, 99, 235, 0.45)'
};

/** Small button to minimize the FAB (shown on FAB hover). */
export const MINIMIZE_BTN: React.CSSProperties = {
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#1e40af',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    zIndex: 1,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)'
};

/** Tooltip shown when hovering over the FAB. */
export const TOOLTIP: React.CSSProperties = {
    position: 'absolute',
    right: '56px',
    top: '50%',
    transform: 'translateY(-50%)',
    backgroundColor: '#1f2937',
    color: '#f9fafb',
    fontSize: '13px',
    lineHeight: '1.4',
    padding: '6px 10px',
    borderRadius: '6px',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)'
};
