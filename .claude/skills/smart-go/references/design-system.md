# Smart Go — Design System

Light-theme color system for a futuristic tech/automation brand. The look should feel
like a modern AI/automation SaaS product — clean, premium, subtly neon. Every visual
decision in the platform must use these tokens.

---

## Brand DNA

- **Primary** — neon blue `#1E90FF` and brand teal `#00D1B2`
- **Gradient** — `135deg, #1E90FF → #00D1B2` for primary CTAs, highlights, key surfaces
- **Backgrounds** — soft cool whites, never pure `#FFFFFF` for the main surface
- **Text** — deep navy tones, never pure black
- **Accents** — subtle blue/teal glow on hover/focus (used sparingly)
- **Personality** — premium, technical, futuristic, *quietly* neon

---

## Color Palette

### Primary

| Token                       | Hex        | Usage                                           |
|-----------------------------|------------|-------------------------------------------------|
| `--primary-blue`            | `#1E90FF`  | Primary brand blue (links, focus, blue accents) |
| `--primary-blue-hover`      | `#1976D2`  | Hover state for blue elements                   |
| `--primary-blue-active`     | `#1565C0`  | Pressed/active state                            |
| `--primary-blue-soft`       | `#E3F2FD`  | Soft tint background (badges, hover surfaces)   |
| `--primary-teal`            | `#00D1B2`  | Primary brand teal                              |
| `--primary-teal-hover`      | `#00B89F`  | Hover state for teal elements                   |
| `--primary-teal-active`     | `#00A085`  | Pressed/active state                            |
| `--primary-teal-soft`       | `#E0F7F4`  | Soft tint background                            |

### Gradient

| Token                       | Value                                                              | Usage                                       |
|-----------------------------|--------------------------------------------------------------------|---------------------------------------------|
| `--gradient-primary`        | `linear-gradient(135deg, #1E90FF 0%, #00D1B2 100%)`                | Primary buttons, key CTAs, brand surfaces   |
| `--gradient-primary-hover`  | `linear-gradient(135deg, #1976D2 0%, #00B89F 100%)`                | Primary button hover                        |
| `--gradient-primary-active` | `linear-gradient(135deg, #1565C0 0%, #00A085 100%)`                | Primary button pressed                      |
| `--gradient-soft`           | `linear-gradient(135deg, rgba(30,144,255,0.08), rgba(0,209,178,0.08))` | Hero sections, highlighted cards         |
| `--gradient-border`         | `linear-gradient(135deg, #1E90FF, #00D1B2)`                        | Gradient borders (use with `border-image`)  |
| `--gradient-text`           | same as primary, used with `background-clip: text`                 | Hero headlines, brand name                  |

### Neutrals & Backgrounds

| Token              | Hex        | Usage                                                |
|--------------------|------------|------------------------------------------------------|
| `--bg-app`         | `#F8FAFC`  | Main app/page background — soft cool white          |
| `--bg-surface`     | `#FFFFFF`  | Cards, modals, table rows                           |
| `--bg-subtle`      | `#F1F5F9`  | Sidebar, table headers, code blocks, secondary surf |
| `--bg-tint-blue`   | `#F0F7FF`  | Section background with blue tint                   |
| `--bg-tint-teal`   | `#ECFDF7`  | Section background with teal tint                   |
| `--bg-overlay`     | `rgba(11, 31, 58, 0.5)` | Modal backdrop                              |

### Text

| Token              | Hex        | Usage                                                |
|--------------------|------------|------------------------------------------------------|
| `--text-primary`   | `#0B1F3A`  | Headings and main body text — deep navy             |
| `--text-secondary` | `#344563`  | Body text, descriptions                              |
| `--text-tertiary`  | `#64748B`  | Captions, helper text, metadata                      |
| `--text-disabled`  | `#94A3B8`  | Disabled labels, placeholder text                    |
| `--text-on-brand`  | `#FFFFFF`  | Text on gradient/brand-colored surfaces              |
| `--text-link`      | `#1E90FF`  | Hyperlinks                                           |
| `--text-link-hover`| `#1565C0`  | Hovered link                                         |

### Borders

| Token              | Hex        | Usage                                                |
|--------------------|------------|------------------------------------------------------|
| `--border-subtle`  | `#F1F5F9`  | Faint dividers                                       |
| `--border-default` | `#E2E8F0`  | Card borders, input borders (default)               |
| `--border-strong`  | `#CBD5E1`  | Emphasized borders, table dividers                   |
| `--border-focus`   | `#1E90FF`  | Focus ring color                                     |

### Status / Accents

| Token             | Hex        | Usage                                                  |
|-------------------|------------|--------------------------------------------------------|
| `--success`       | `#10B981`  | Success buttons, success icons                         |
| `--success-soft`  | `#ECFDF5`  | Success badge background                               |
| `--success-text`  | `#047857`  | Success text on `--success-soft`                       |
| `--warning`       | `#F59E0B`  | Warning icons, freeze warnings                         |
| `--warning-soft`  | `#FFFBEB`  | Warning badge background                               |
| `--warning-text`  | `#B45309`  | Warning text on `--warning-soft`                       |
| `--error`         | `#EF4444`  | Destructive buttons, error icons                       |
| `--error-soft`    | `#FEF2F2`  | Error badge background                                 |
| `--error-text`    | `#B91C1C`  | Error text on `--error-soft`                           |
| `--info`          | `#1E90FF`  | Info icons (re-uses primary blue)                      |
| `--info-soft`     | `#EFF6FF`  | Info badge background                                  |

### Shadows (subtle elevation + neon glow)

| Token                  | Value                                                                                         | Usage                                |
|------------------------|-----------------------------------------------------------------------------------------------|--------------------------------------|
| `--shadow-xs`          | `0 1px 2px rgba(11, 31, 58, 0.04)`                                                            | Small elements (badges)              |
| `--shadow-sm`          | `0 1px 3px rgba(11, 31, 58, 0.06), 0 1px 2px rgba(11, 31, 58, 0.04)`                          | Inputs, default cards                |
| `--shadow-md`          | `0 4px 12px rgba(11, 31, 58, 0.06), 0 1px 3px rgba(11, 31, 58, 0.04)`                         | Hovered cards, dropdowns             |
| `--shadow-lg`          | `0 12px 24px rgba(11, 31, 58, 0.08), 0 4px 8px rgba(11, 31, 58, 0.04)`                        | Modals, popovers                     |
| `--shadow-glow-blue`   | `0 0 0 4px rgba(30, 144, 255, 0.12), 0 4px 16px rgba(30, 144, 255, 0.18)`                     | Focused inputs, hovered blue items   |
| `--shadow-glow-teal`   | `0 0 0 4px rgba(0, 209, 178, 0.12), 0 4px 16px rgba(0, 209, 178, 0.18)`                       | Teal accents on hover                |
| `--shadow-glow-brand`  | `0 4px 20px rgba(30, 144, 255, 0.20), 0 4px 20px rgba(0, 209, 178, 0.18)`                     | Primary CTA hover                    |

### Radius

| Token             | Value     | Usage                                  |
|-------------------|-----------|----------------------------------------|
| `--radius-xs`     | `4px`     | Tags, tiny chips                       |
| `--radius-sm`     | `6px`     | Inputs, small buttons                  |
| `--radius-md`     | `10px`    | Buttons, cards (default)               |
| `--radius-lg`     | `14px`    | Large cards, modals                    |
| `--radius-xl`     | `20px`    | Hero panels, feature cards             |
| `--radius-pill`   | `999px`   | Pills, avatars, status dots            |

### Spacing scale

| Token         | Value   |
|---------------|---------|
| `--space-1`   | `4px`   |
| `--space-2`   | `8px`   |
| `--space-3`   | `12px`  |
| `--space-4`   | `16px`  |
| `--space-5`   | `20px`  |
| `--space-6`   | `24px`  |
| `--space-8`   | `32px`  |
| `--space-10`  | `40px`  |
| `--space-12`  | `48px`  |
| `--space-16`  | `64px`  |

---

## Typography

**Fonts** — load both from Google Fonts in every page `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
```

- **`Inter`** — body text and UI (`--font-body`)
- **`Space Grotesk`** — headings and brand displays (`--font-display`)

Type scale tokens:

| Token             | Size / line-height       | Weight | Usage                          |
|-------------------|--------------------------|--------|--------------------------------|
| `--text-xs`       | `12px / 16px`            | 500    | Captions, metadata             |
| `--text-sm`       | `14px / 20px`            | 500    | Secondary UI                   |
| `--text-base`     | `16px / 24px`            | 400    | Body                           |
| `--text-lg`       | `18px / 28px`            | 500    | Lead text                      |
| `--text-xl`       | `20px / 28px`            | 600    | Card titles                    |
| `--text-2xl`      | `24px / 32px`            | 600    | Section titles                 |
| `--text-3xl`      | `30px / 38px`            | 700    | Page titles                    |
| `--text-4xl`      | `36px / 44px`            | 700    | Hero headlines                 |

---

## UI States — Reference

### Hover
- Buttons gain `--shadow-glow-brand` (gradient buttons) or `--shadow-md` (neutral buttons)
- Cards gain `--shadow-md` and lift `transform: translateY(-2px)`
- Links go from `--text-link` to `--text-link-hover`, underline appears
- Table rows tint to `--bg-subtle`

### Active / Pressed
- Buttons reduce shadow, scale down `transform: scale(0.98)`, switch to `--gradient-primary-active`
- Cards reduce shadow

### Focus (keyboard / accessibility)
- All focusable elements gain a 2px outline using `--border-focus`, with `--shadow-glow-blue` outside
- Never remove focus indicators — only restyle them

### Disabled
- Background → `--bg-subtle`
- Text → `--text-disabled`
- `cursor: not-allowed`
- `opacity: 0.6` (do NOT also reduce contrast — pick one)

### Loading
- Use a thin 2px gradient bar across the top of the surface (re-use `--gradient-primary`) animating via `keyframes`
- For inline buttons, swap label with a spinning circle in `--text-on-brand`

---

## Component Recipes

These go in `public/shared/css/components.css`. Use these recipes verbatim for the
build to stay consistent.

### Buttons

```css
/* Base */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 10px 20px;
  font: 600 var(--text-sm)/1 var(--font-body);
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 160ms ease, box-shadow 160ms ease, transform 80ms ease, border-color 160ms ease;
  white-space: nowrap;
  user-select: none;
}
.btn:disabled { opacity: 0.6; cursor: not-allowed; }

/* Primary — gradient with subtle glow on hover */
.btn-primary {
  background: var(--gradient-primary);
  color: var(--text-on-brand);
  box-shadow: var(--shadow-sm);
}
.btn-primary:hover:not(:disabled) {
  background: var(--gradient-primary-hover);
  box-shadow: var(--shadow-glow-brand);
}
.btn-primary:active:not(:disabled) {
  background: var(--gradient-primary-active);
  transform: scale(0.98);
  box-shadow: var(--shadow-sm);
}

/* Secondary — outlined, picks up gradient border on hover */
.btn-secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}
.btn-secondary:hover:not(:disabled) {
  background: var(--bg-tint-blue);
  border-color: var(--primary-blue);
  color: var(--primary-blue-hover);
}

/* Ghost — minimal, for table row actions */
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}
.btn-ghost:hover:not(:disabled) {
  background: var(--bg-subtle);
  color: var(--text-primary);
}

/* Destructive */
.btn-danger {
  background: var(--error);
  color: var(--text-on-brand);
}
.btn-danger:hover:not(:disabled) {
  background: #DC2626;
  box-shadow: 0 4px 16px rgba(239, 68, 68, 0.25);
}

/* Sizes */
.btn-sm { padding: 6px 14px; font-size: var(--text-xs); }
.btn-lg { padding: 14px 28px; font-size: var(--text-base); }
```

### Cards

```css
.card {
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
  transition: box-shadow 200ms ease, transform 200ms ease, border-color 200ms ease;
}
.card-interactive:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
  border-color: var(--border-strong);
}
.card-feature {
  background: var(--gradient-soft);
  border: 1px solid var(--primary-blue-soft);
}
.card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: var(--space-4);
}
.card-title { font: 600 var(--text-xl)/1.3 var(--font-display); color: var(--text-primary); }
.card-subtitle { font-size: var(--text-sm); color: var(--text-tertiary); }
```

### Inputs

```css
.input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);
  font: 400 var(--text-base)/1.4 var(--font-body);
  color: var(--text-primary);
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.input::placeholder { color: var(--text-disabled); }
.input:hover { border-color: var(--border-strong); }
.input:focus {
  outline: none;
  border-color: var(--border-focus);
  box-shadow: var(--shadow-glow-blue);
}
.input:disabled { background: var(--bg-subtle); color: var(--text-disabled); cursor: not-allowed; }
.input-error { border-color: var(--error); }
.input-error:focus { box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12); }
```

### Links

```css
a, .link {
  color: var(--text-link);
  text-decoration: none;
  transition: color 160ms ease;
}
a:hover, .link:hover {
  color: var(--text-link-hover);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.link-gradient {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-weight: 600;
}
```

### Badges

```css
.badge {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 2px 10px;
  font: 500 var(--text-xs)/1 var(--font-body);
  border-radius: var(--radius-pill);
}
.badge-blue    { background: var(--primary-blue-soft); color: var(--primary-blue-active); }
.badge-teal    { background: var(--primary-teal-soft); color: var(--primary-teal-active); }
.badge-success { background: var(--success-soft); color: var(--success-text); }
.badge-warning { background: var(--warning-soft); color: var(--warning-text); }
.badge-error   { background: var(--error-soft); color: var(--error-text); }
.badge-neutral { background: var(--bg-subtle); color: var(--text-secondary); }
```

### Sections

```css
.section {
  padding: var(--space-12) var(--space-8);
}
.section-tinted {
  background: var(--bg-tint-blue);
  border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
}
.section-hero {
  background: var(--gradient-soft);
  border-radius: var(--radius-xl);
  padding: var(--space-16) var(--space-8);
}
.section-title {
  font: 700 var(--text-3xl)/1.2 var(--font-display);
  color: var(--text-primary);
  margin-bottom: var(--space-2);
}
.section-subtitle {
  font: 400 var(--text-lg)/1.5 var(--font-body);
  color: var(--text-tertiary);
  margin-bottom: var(--space-8);
}
```

### Modals

```css
.modal-backdrop {
  position: fixed; inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.modal {
  background: var(--bg-surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  padding: var(--space-8);
  max-width: 520px; width: calc(100% - 32px);
  border: 1px solid var(--border-default);
}
.modal-title { font: 600 var(--text-2xl)/1.3 var(--font-display); margin-bottom: var(--space-2); }
```

### Tables

```css
.table { width: 100%; border-collapse: collapse; }
.table th {
  text-align: left;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-subtle);
  color: var(--text-tertiary);
  font: 500 var(--text-xs)/1 var(--font-body);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border-default);
}
.table td {
  padding: var(--space-4);
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-subtle);
  font-size: var(--text-sm);
}
.table tr:hover td { background: var(--bg-tint-blue); }
```

---

## Logo & Branding

The "Smart Go" logo already uses neon blue and teal. When placing it on a surface:

- Default: place on `--bg-surface` or `--bg-app`
- On gradient/colored backgrounds: use a white version
- Minimum clear space around logo: `--space-4` on all sides
- Pair with the wordmark in `--font-display`, weight 700, color `--text-primary` (or use `.link-gradient` for hero treatment)

---

## Motion

- **Default duration**: `160ms` for color/shadow, `200ms` for transform/layout
- **Easing**: `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out)
- **Page transitions**: 200ms fade — never slide (feels less "premium")
- Respect `@media (prefers-reduced-motion: reduce)` — disable transforms, keep color transitions

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```

---

## Do / Don't

| ✅ Do                                                  | ❌ Don't                                          |
|--------------------------------------------------------|---------------------------------------------------|
| Use `var(--gradient-primary)` on the primary CTA       | Use the gradient on every button                  |
| Use `--bg-app` for the page background                 | Use pure `#FFFFFF` for everything                 |
| Use `--text-primary` for headings                      | Use pure black `#000`                             |
| Use subtle glow shadows on focus/hover                 | Make every element glow at rest                   |
| One gradient or accent moment per screen               | Stack three gradient buttons in a row             |
| Pair with plenty of `--bg-app` whitespace              | Cram colored sections back-to-back                |
