/**
 * @repo/feedback - UI primitives barrel export.
 *
 * Lightweight Shadcn-compatible components designed for use inside the feedback
 * package. They rely on CSS custom properties (`--primary`, `--destructive`,
 * `--border`, `--input`, `--ring`, `--background`, `--foreground`, `--muted`,
 * `--accent`) and Tailwind semantic tokens that must be provided by the host app.
 */

export type { ButtonProps, ButtonSize, ButtonVariant } from './Button.js';
export { Button } from './Button.js';
export { cn } from './cn.js';
export type { InputProps } from './Input.js';
export { Input } from './Input.js';
export type { LabelProps } from './Label.js';
export { Label } from './Label.js';
export type { SelectProps } from './Select.js';
export { Select } from './Select.js';
export type { TextareaProps } from './Textarea.js';
export { Textarea } from './Textarea.js';
