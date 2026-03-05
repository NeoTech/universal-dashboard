# UI Primitives & Theming

## Overview

The dashboard is built on a small, self-contained SolidJS component library. Every primitive is a pure SolidJS function component or hook — no external UI framework is used. Components are styled exclusively via CSS custom properties (design tokens) defined in `src/styles/tokens.css`, ensuring consistent theming across dark and light modes.

---

## Component Catalogue

### StripeDrawer

Slide-in side panel for displaying Stripe object details. A backdrop overlay is rendered behind the panel; clicking it dismisses the drawer.

**File:** `src/ui/StripeDrawer.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | yes | Controls panel visibility. |
| `title` | `string` | yes | Header text and `aria-label` for the `role="dialog"` region. |
| `onClose` | `() => void` | yes | Called when the close button or backdrop is clicked. |
| `children` | `JSX.Element` | yes | Body content rendered inside the drawer. |

**Usage**

```tsx
const [open, setOpen] = createSignal(false);

<StripeDrawer isOpen={open()} title="Payment detail" onClose={() => setOpen(false)}>
  <ChargeDetails charge={charge} />
</StripeDrawer>
```

---

### ConfirmDialog

Modal dialog for confirming destructive or irreversible actions. Renders as an `alertdialog` ARIA role with Cancel and Confirm buttons. Clicking the backdrop invokes `onCancel`.

**File:** `src/ui/ConfirmDialog.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `isOpen` | `boolean` | yes | Whether the dialog is visible. |
| `message` | `string` | yes | Body text explaining the action. |
| `confirmLabel` | `string` | no | Label for the confirm button. Default: `'Confirm'`. |
| `danger` | `boolean` | no | Renders the confirm button with the danger style. |
| `onConfirm` | `() => void` | yes | Called when the user confirms. |
| `onCancel` | `() => void` | yes | Called when the user cancels or clicks the backdrop. |

**Usage**

```tsx
<ConfirmDialog
  isOpen={showConfirm()}
  message="This will permanently delete the customer."
  danger
  onConfirm={handleDelete}
  onCancel={() => setShowConfirm(false)}
/>
```

---

### CommandPalette

Fuzzy-search command palette overlay. Opens as a modal when `isOpen` is truthy. The user types to filter commands by label substring; arrow keys navigate, Enter executes, Escape closes.

**File:** `src/ui/CommandPalette.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `commands` | `Command[]` | yes | Full list of available commands. |
| `isOpen` | `Accessor<boolean> \| boolean` | yes | Whether the palette is visible. |
| `onClose` | `() => void` | no | Called after a command runs or Escape is pressed. |

**`Command` shape**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Stable unique identifier. |
| `label` | `string` | Display text; searched by the filter input. |
| `run` | `() => void` | Callback invoked on selection. |

**Usage**

```tsx
const commands: Command[] = [
  { id: 'add-tile', label: 'Add tile', run: openAddTile },
  { id: 'toggle-theme', label: 'Toggle theme', run: toggleTheme },
];

<CommandPalette
  commands={commands}
  isOpen={paletteOpen()}
  onClose={() => setPaletteOpen(false)}
/>
```

---

### Badge

Inline colour-coded status label. Applies a variant class that maps to semantic token colours.

**File:** `src/ui/Badge.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `variant` | `'success' \| 'warning' \| 'danger' \| 'neutral'` | no | Visual style. Default: `'neutral'`. |
| `children` | `JSX.Element` | yes | Badge text content. |

**Usage**

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="danger">Failed</Badge>
<Badge>Unknown</Badge>
```

---

### Skeleton

Animated shimmer placeholder displayed while content is loading. Renders one or multiple lines; when multiple lines are shown the last one is 60 % wide to mimic natural paragraph endings.

**File:** `src/ui/Skeleton.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `width` | `string` | no | CSS width per line. Default: `'100%'`. |
| `height` | `string` | no | CSS height per line. Default: `'1em'`. |
| `lines` | `number` | no | Number of placeholder lines. Default: `1`. |

**Usage**

```tsx
// Single line
<Skeleton height="14px" />

// Multi-line text block
<Skeleton lines={4} height="13px" />
```

---

### Sparkline

Tiny inline SVG line chart for embedding in tile titlebars or table cells. The Y-axis normalises all values to fill the full height, conveying trend only. The element is `aria-hidden`; surrounding text should carry the accessible value.

**File:** `src/ui/Sparkline.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `number[]` | yes | Ordered series of values. Requires ≥ 2 points to render. |
| `w` | `number` | no | SVG width in pixels. Default: `120`. |
| `h` | `number` | no | SVG height in pixels. Default: `32`. |
| `color` | `string` | no | Polyline stroke colour. Default: `var(--twm-color-accent)`. |

**Usage**

```tsx
<Sparkline data={priceSeries} w={80} h={24} />
```

---

### BarChart

Horizontal bar chart for ranked list data. Bar widths are proportional to the maximum value in the current dataset. Includes optional numeric value labels and a custom value formatter.

**File:** `src/ui/BarChart.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `BarChartItem[]` | yes | Data rows. Each has `label`, `value`, and optional `color`. |
| `maxItems` | `number` | no | Caps the rendered row count. Default: `10`. |
| `height` | `number` | no | Row height in pixels. Default: `14`. |
| `showValues` | `boolean` | no | Show numeric labels to the right of bars. Default: `true`. |
| `formatValue` | `(v: number) => string` | no | Custom value formatter. Default: `String(v)`. |

**Usage**

```tsx
<BarChart
  items={topCountries}
  maxItems={5}
  formatValue={(v) => `$${v.toLocaleString()}`}
/>
```

---

### MiniChart

Full-featured SVG chart for tile content areas. Supports three chart types driven by a flat `number[]` data series. Y-axis labels are rendered as an absolutely-positioned overlay to avoid SVG text distortion.

**File:** `src/ui/MiniChart.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `number[]` | yes | Ordered series of numeric values. |
| `type` | `'line' \| 'bar' \| 'candle'` | no | Chart type. Default: `'line'`. |
| `label` | `string` | no | Caption rendered below the chart. |
| `height` | `number` | no | SVG height in pixels. Default: `200`. |
| `window` | `number` | no | Maximum number of visible data points. Default: `50`. |

**Chart type notes**

- **line** — polyline with gradient fill; ideal for price history and sensor readings.
- **bar** — vertical rectangles; ideal for counts and volumes.
- **candle** — synthetic OHLC candlesticks: each adjacent pair of values is treated as open/close; a wick extends ±30 % of body height beyond the body.

**Usage**

```tsx
<MiniChart data={closePrices} type="candle" label="BTC / USD" height={180} />
```

---

### AriaPanel

Accessible `role="region"` wrapper for a tiling panel. Sets `aria-label` and `aria-current` so assistive technologies can identify focused panels as landmarks.

**File:** `src/ui/AriaPanel.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `panelId` | `string` | yes | Written to `data-panel-id` for CSS targeting and automation. |
| `label` | `string` | yes | The `aria-label` text for the region. |
| `isFocused` | `boolean` | no | When `true`, sets `aria-current="true"`. |
| `children` | `JSX.Element` | yes | Panel body content. |

**Usage**

```tsx
<AriaPanel panelId={panel.id} label={panel.title} isFocused={panel.id === focusedId()}>
  <PanelContent panel={panel} />
</AriaPanel>
```

---

### TabBar

Horizontal tab strip rendered at the top of a panel. Uses `role="tablist"` / `role="tab"` markup and marks the active tab with `aria-selected="true"`. An optional close button per tab is shown when `onTabClose` is provided.

**File:** `src/ui/TabBar.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `tabs` | `Tab[]` | yes | Ordered list of tab descriptors. |
| `activeTabId` | `string` | yes | `id` of the currently selected tab. |
| `onTabSelect` | `(tabId: string) => void` | yes | Called when a tab is clicked. |
| `onTabClose` | `(tabId: string) => void` | no | When provided, renders a close button on every tab. |

**`Tab` shape**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Stable identifier. |
| `label` | `string` | Display text. |
| `contentType` | `string` | Content-type key used by the panel renderer. |

**Usage**

```tsx
<TabBar
  tabs={panel.tabs}
  activeTabId={activeTab()}
  onTabSelect={setActiveTab}
  onTabClose={closeTab}
/>
```

---

### ContextMenu

Right-click context menu positioned at fixed document coordinates. An outside-click listener dismisses the menu automatically. Items can be disabled individually.

**File:** `src/ui/ContextMenu.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `items` | `MenuItem[]` | yes | List of menu entries. |
| `position` | `{ x: number; y: number }` | yes | Fixed pixel position in the document. |
| `isOpen` | `Accessor<boolean> \| boolean` | yes | Whether the menu is visible. |
| `onSelect` | `(id: string) => void` | no | Called with the selected item's `id`. |
| `onClose` | `() => void` | no | Called when the menu should close. |

**`MenuItem` shape**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Identifier passed to `onSelect`. |
| `label` | `string` | Display text. |
| `disabled` | `boolean` | When `true`, the item is non-interactive. |

**Usage**

```tsx
<ContextMenu
  items={[{ id: 'rename', label: 'Rename panel' }, { id: 'close', label: 'Close' }]}
  position={menuPos()}
  isOpen={menuOpen()}
  onSelect={handleMenuSelect}
  onClose={() => setMenuOpen(false)}
/>
```

---

### TileRefreshTimer

Tiny SVG countdown ring displayed in the tile titlebar. Uses a pure CSS animation keyed off the `intervalMs` prop — no JS timers or reactive state. When `onRefresh` is supplied it fires on every `animationiteration` event, which is precisely when the ring resets, so tile data refreshes synchronously with the visual cycle.

**File:** `src/ui/TileRefreshTimer.tsx`

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `intervalMs` | `number` | yes | Poll interval in milliseconds. Drives the animation duration. |
| `label` | `string` | no | Tooltip text. Auto-generated from `intervalMs` when omitted. |
| `onRefresh` | `() => void` | no | Called on every completed animation cycle. |

**Usage**

```tsx
<TileRefreshTimer
  intervalMs={30_000}
  onRefresh={refetchTileData}
/>
```

---

### ToastManager

Imperative class-based API for queuing toast notifications. Toasts auto-dismiss after `duration` ms; pass `duration: 0` for sticky toasts. Subscribe to changes with `onChange` to drive a reactive toast renderer.

**File:** `src/ui/ToastManager.ts`

| Method | Signature | Description |
|--------|-----------|-------------|
| `toasts()` | `() => readonly Toast[]` | Current snapshot of active toasts. |
| `show(options)` | `(ShowOptions) => string` | Enqueue a toast; returns its `id`. |
| `dismiss(id)` | `(string) => void` | Remove a toast and cancel its timer. |
| `onChange(cb)` | `(cb: () => void) => () => void` | Subscribe to list changes; returns an unsubscribe function. |

**`Toast` shape**

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier assigned on creation. |
| `message` | `string` | Notification body text. |
| `type` | `'info' \| 'success' \| 'warning' \| 'error'` | Visual severity level. |
| `duration` | `number` | Auto-dismiss delay in ms (`0` = sticky). |

**Usage**

```ts
const toasts = new ToastManager();

toasts.show({ message: 'Saved!', type: 'success' });
toasts.show({ message: 'Check your network', type: 'error', duration: 0 });

// In a SolidJS component:
onMount(() => {
  const unsub = toasts.onChange(() => setToastList([...toasts.toasts()]));
  onCleanup(unsub);
});
```

---

### HintsContext

Global context that drives the keyboard hint bar in the status strip. Consumers call `setHints` to publish a context-specific shortcut list; the status bar reads it reactively.

**File:** `src/ui/HintsContext.tsx`

| Export | Description |
|--------|-------------|
| `HintsProvider` | Context provider; wrap the root app tree once. |
| `useHints()` | Returns `{ hints, setHints }` from the nearest provider. |
| `usePublishHints(hints)` | Convenience function: calls `setHints` immediately for static hint sets. |
| `HINTS_DEFAULT` | Default shortcuts shown when no panel or modal is active. |
| `HINTS_PALETTE` | Shortcuts shown while the CommandPalette is open. |

**`Hint` shape**

| Field | Type | Description |
|-------|------|-------------|
| `keys` | `string` | Key combination string, e.g. `'Ctrl+P'` or `'↑↓'`. |
| `label` | `string` | Human-readable description of the action. |

**Usage**

```tsx
// At the root:
<HintsProvider>
  <App />
</HintsProvider>

// Inside a component that has modal-specific shortcuts:
const { setHints } = useHints();
createEffect(() => {
  if (isOpen()) setHints(HINTS_PALETTE);
  else setHints(HINTS_DEFAULT);
});
```

---

## Hooks

### useStripeAction

Wraps an async Stripe API function with reactive `loading` and `error` state. `StripeApiError` instances are formatted with their HTTP status code; all other errors fall back to `error.message`.

**File:** `src/ui/useStripeAction.ts`

**Signature**

```ts
function useStripeAction<TArgs extends unknown[]>(
  fn: (...args: TArgs) => Promise<unknown>,
  options?: { onSuccess?: () => void },
): StripeActionHandle<TArgs>
```

**`StripeActionHandle<TArgs>` shape**

| Field | Type | Description |
|-------|------|-------------|
| `execute` | `(...args: TArgs) => Promise<void>` | Invoke the async function; updates `loading` and `error`. |
| `loading` | `() => boolean` | `true` while the call is in flight. |
| `error` | `() => string \| null` | Last error message, or `null` on success. |
| `reset` | `() => void` | Clear the error without re-executing. |

**Usage**

```tsx
const refund = useStripeAction(
  (chargeId: string) => api.refundCharge(chargeId),
  { onSuccess: () => refetch() },
);

<button disabled={refund.loading()} onClick={() => refund.execute(chargeId)}>
  {refund.loading() ? 'Refunding…' : 'Refund'}
</button>
<Show when={refund.error()}>
  <p class="error">{refund.error()}</p>
</Show>
```

---

### useSseChannel

Subscribe to a named event on the shared `/api/sse` stream. Handles reconnection, backpressure, and cleanup automatically. See [docs/sse.md](sse.md) for full details and advanced usage.

**File:** `src/ui/useSseChannel.ts`

**Quick reference**

```ts
const { data, loading, error } = useSseChannel<MyPayload[]>('my-channel', []);
```

---

## CSS Token System

All design tokens are defined in `src/styles/tokens.css` and applied through CSS custom properties. Light-theme overrides live in the `[data-theme="light"]` selector block.

### Color Tokens

| Token | Dark value | Light value | Usage |
|-------|-----------|-------------|-------|
| `--twm-color-bg` | `#0d0d0d` | `#f5f5f5` | Page / canvas background. |
| `--twm-color-surface` | `#181818` | `#ffffff` | Panel and modal backgrounds. |
| `--twm-color-surface2` | `#222222` | `#ebebeb` | Secondary surfaces, kbd badges. |
| `--twm-color-border` | `#2e2e2e` | `#d0d0d0` | Dividers, panel borders. |
| `--twm-color-text` | `#e8e8e8` | `#1a1a1a` | Primary text. |
| `--twm-color-text-dim` | `#888888` | `#6e6e6e` | Secondary / dimmed text. |
| `--twm-color-accent` | `#4c9ee8` | `#1a73e8` | Interactive highlights, focus rings, sparklines. |
| `--twm-color-accent-hover` | `#5eb0f0` | `#1558b0` | Accent on hover. |
| `--twm-color-danger` | `#e84c4c` | `#c62828` | Destructive actions, error badges. |
| `--twm-color-success` | `#3dba6e` | `#2e7d32` | Success states and badges. |
| `--twm-color-warning` | `#e8a84c` | `#bf6a00` | Warning states and badges. |
| `--twm-color-hint` | `#666666` | `#888888` | Hint bar key labels. |

### Typography Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--twm-font-family` | `"Inter", "Segoe UI", system-ui, sans-serif` | Body and UI text. |
| `--twm-font-mono` | `"JetBrains Mono", "Fira Code", monospace` | Code, kbd badges, numeric values. |
| `--twm-font-size-xs` | `11px` | Status-bar labels, tooltips. |
| `--twm-font-size-sm` | `12px` | Titlebar text, secondary labels. |
| `--twm-font-size-base` | `13px` | Default body text. |
| `--twm-font-size-lg` | `15px` | Modal headings. |

### Spacing Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--twm-gap-inner` | `8px` | Padding inside panels and toolbars. |
| `--twm-gap-outer` | `0px` | Outer margin between panels (controlled by layout engine). |
| `--twm-gap-handle` | `4px` | Width/height of resize handle hit-targets. |

### Border & Radius Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--twm-radius-sm` | `2px` | Buttons, small chips, kbd badges. |
| `--twm-radius` | `4px` | Panels, inputs, standard controls. |
| `--twm-radius-lg` | `8px` | Modals, drawers. |

### Transition Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--twm-transition` | `150ms ease` | Hover state transitions (colour, background). |
| `--twm-transition-slow` | `300ms ease` | Layout animations, drawer slide-in. |

### Z-Index Ladder

| Token | Value | Usage |
|-------|-------|-------|
| `--twm-z-base` | `0` | Default stacking context. |
| `--twm-z-panel` | `10` | Resize handle overlays. |
| `--twm-z-focused` | `20` | The focused panel. |
| `--twm-z-float` | `100` | Floating popovers. |
| `--twm-z-statusbar` | `200` | Status bar. |
| `--twm-z-modal` | `1000` | Modals and dialogs. |
| `--twm-z-toast` | `2000` | Toast notifications. |

---

## Dark / Light Theme Switching

### How ThemeManager works

`ThemeManager` (`src/config/ThemeManager.ts`) is a plain class instantiated once at application startup. It:

1. Reads the persisted theme name from `localStorage` (key: `twm-theme`).
2. Validates the stored value against `THEMES = ['dark', 'light']`; falls back to `'dark'` if invalid.
3. Writes `data-theme="{name}"` onto `document.documentElement`.
4. On every `setTheme(name)` call: validates, updates `document.documentElement`, and persists to `localStorage`.

The CSS in `tokens.css` scopes light-mode overrides to `[data-theme="light"]`, so switching themes is instant — no page reload needed.

### Referencing tokens in new components

Always use the design tokens instead of hard-coded colour values:

```css
.my-component {
  background: var(--twm-color-surface);
  color: var(--twm-color-text);
  border: 1px solid var(--twm-color-border);
  border-radius: var(--twm-radius);
  font-size: var(--twm-font-size-sm);
}

.my-component:hover {
  background: var(--twm-color-surface2);
}
```

This automatically picks up the correct value for whichever theme is active.

---

## ARIA & Accessibility Patterns

### AriaPanel and landmark regions

Wrap every tiling panel in `<AriaPanel>` so that screen-reader users can navigate between panels as named landmarks:

```tsx
<AriaPanel panelId={panel.id} label={panel.title} isFocused={focused}>
  {/* panel body */}
</AriaPanel>
```

`AriaPanel` renders `role="region"` with `aria-label` and `tabIndex={0}`, making each panel keyboard-reachable and identifiable to assistive technologies.

### Focus rings

The focused panel is highlighted using `--twm-color-accent` without a separate focus-ring token:

```css
/* base.css */
.panel[data-focused] {
  outline: 2px solid var(--twm-color-accent);
  outline-offset: -2px;
  box-shadow: 0 0 0 1px var(--twm-color-accent);
  z-index: var(--twm-z-focused);
}
```

Do not suppress focus indicators. If adding interactive elements that receive keyboard focus, ensure a visible outline using `--twm-color-accent`.

### aria-live regions in toasts

The `ToastManager` is imperative: it manages the list but does not render UI itself. The toast renderer component (consuming `onChange`) should mount its container with `aria-live="polite"` (or `"assertive"` for errors) so screen readers announce new notifications:

```tsx
<div aria-live="polite" aria-atomic="false" class="toast-container">
  <For each={toastList()}>
    {(toast) => <div role="status">{toast.message}</div>}
  </For>
</div>
```

### Decorative elements

Charts and sparklines that duplicate information already present as text should be `aria-hidden="true"` (as `Sparkline` and `MiniChart` already are). Always pair them with accessible text that conveys the same data.
