/**
 * Idle: muted icon, no fill. Hover: `bg-muted` + bright icon.
 * Open panel / pressed: bright icon, **no** fill until hover (overrides ghost `aria-expanded:bg-muted`).
 */
export const activityBarIconButtonClass =
  'text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 aria-pressed:text-foreground aria-pressed:hover:bg-muted dark:aria-pressed:hover:bg-muted/50 aria-expanded:!bg-transparent aria-expanded:text-foreground aria-expanded:hover:!bg-muted dark:aria-expanded:hover:!bg-muted/50'
