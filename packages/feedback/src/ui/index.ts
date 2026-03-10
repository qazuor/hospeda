/**
 * @repo/feedback - UI primitives barrel export.
 *
 * Lightweight Shadcn-compatible components designed for use inside the feedback
 * package. They rely on CSS custom properties (`--primary`, `--destructive`,
 * `--border`, `--input`, `--ring`, `--background`, `--foreground`, `--muted`,
 * `--accent`) and Tailwind semantic tokens that must be provided by the host app.
 */

export { Button } from './Button.js';
export type { ButtonProps, ButtonVariant, ButtonSize } from './Button.js';

export { Input } from './Input.js';
export type { InputProps } from './Input.js';

export { Textarea } from './Textarea.js';
export type { TextareaProps } from './Textarea.js';

export { Select } from './Select.js';
export type { SelectProps } from './Select.js';

export { Label } from './Label.js';
export type { LabelProps } from './Label.js';

export { cn } from './cn.js';
