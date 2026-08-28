// Shared Tailwind class strings for the admin panel.
// Tailwind-only (globals.css is owned by another agent).

// Min 44px touch targets on mobile for primary buttons; desktop keeps the
// compact sizing from the hd-* CSS. The `!` suffix (Tailwind v4 important
// modifier) is required because `.btn-sm { min-height: 32px }` is unlayered
// CSS which would otherwise beat layered Tailwind utilities.
export const TOUCH_TARGET = "min-h-[44px]! md:min-h-0!";

// Same as TOUCH_TARGET plus a min width, for icon-only buttons (✕, 🗑, ✏).
export const TOUCH_TARGET_ICON =
  "min-h-[44px]! md:min-h-0! min-w-[44px]! md:min-w-0!";

// Consistent keyboard focus ring (accent gold). Uses the @theme mapping
// --color-accent → var(--accent) from globals.css, so it follows the theme.
export const FOCUS_RING =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Long-list scroll area: horizontal drag/scroll for wide tables plus a capped
// height with vertical scrolling. The custom themed scrollbar comes from the
// global `::-webkit-scrollbar` rules already in globals.css.
export const SCROLL_AREA = "overflow-x-auto max-h-96 overflow-y-auto";
