---
version: alpha
name: m4m Signal desk
description: A private automation workbench with readable routing diagrams and instrument-like controls.
colors:
  background: "#14171b"
  surface: "#1c2127"
  raised: "#252c34"
  primary: "#b8d2e8"
  signal: "#e8bf66"
  foreground: "#f1f3f5"
  muted: "#a5afb9"
  border: "#38414b"
  success: "#9dc6b1"
  danger: "#f3a09b"
typography:
  display:
    fontFamily: "Barlow Condensed, Arial Narrow, sans-serif"
  sans:
    fontFamily: "IBM Plex Sans Variable, Segoe UI, sans-serif"
  mono:
    fontFamily: "IBM Plex Mono, Consolas, monospace"
rounded:
  DEFAULT: "6px"
  sm: "4px"
  lg: "10px"
spacing:
  page: "36px"
  section: "28px"
  control: "12px"
components:
  button:
    rounded: "{rounded.DEFAULT}"
    backgroundColor: "{colors.primary}"
    textColor: "{colors.background}"
  input:
    rounded: "{rounded.DEFAULT}"
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
  routePort:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.signal}"
  secondaryText:
    textColor: "{colors.muted}"
  divider:
    backgroundColor: "{colors.border}"
  successStatus:
    textColor: "{colors.success}"
  errorMessage:
    textColor: "{colors.danger}"
---

# m4m design system

## Overview

m4m helps individuals connect email and messaging services, build reusable AI agents, and inspect automation executions. This is a product surface, not a marketing site. Evidence: README.md, docs/api.md, and existing React Flow editor. English is the current interface language; user content may use any script. No Japan-specific market scope is established.

The reference is a signal-routing desk: quiet equipment surfaces, labelled ports, clear active paths. The memorable signature is a **route strip**: actual saved workflow nodes connected in a compact readable sequence, with explicit branch annotations. Drafts never look as though they are executing. The canvas remains central; configuration stays on the right.

The user's current request authorizes a system redesign. Earlier mint gradients, floating card galleries and ambient lights are retired. A generic dark dashboard with a bright action color was rejected during planning: the distinction must come from real routing information and screen composition, not another accent color.

Runtime CSS is canonical (model B): palette/type tokens and shared identity in app/signal-desk.css, Tailwind adapters and established geometry in app/globals.css, workflow collection in app/workflow-overview.css. This document mirrors accepted values. All Tailwind primitives consume the existing semantic HSL adapters. Fonts are bundled locally through Fontsource; no runtime font service.

## Colors

Graphite surfaces retain the user's dark preference. Blue-grey means navigation, selection and primary action. Amber is reserved for trigger ports and route diagrams. Muted green means active/succeeded; muted red means error or destructive action. Text, icons and labels accompany every state. Layers use solid colors, not glass or gradients. Forced colors use system colors.

## Typography

Barlow Condensed at 42–48px gives page headings the character of equipment labels; never use it for long text or forms. IBM Plex Sans at 14px/1.5 handles interface content; form fields use 16px on phones. IBM Plex Mono is reserved for revisions, identifiers and execution data. Use sentence case and real status vocabulary.

## Layout

208px desktop navigation, 60px top bar; 72px rail in canvas mode. Page content is capped at 1320px with 36px gutters (18px on phones). Collection route strips combine name, real topology and revision metadata in one row. Agents use prompt-led cards; credentials use a table with a separate security explanation; account settings use labelled form sections. The canvas alone owns viewport height. Forms retain natural document scrolling.

```
| nav | section / workspace                  search |
|     | Workflows                 import / create  |
|     | all / active / drafts       search / view  |
|     | name + status | trigger — process — action |
|     | name + status | trigger — branch ↗         |
|     | displayed count / paging     worker state  |
```

At narrow widths the route strip stacks; navigation becomes an accessible dialog. The right workflow tools drawer remains independently scrollable. Tables may scroll horizontally, never hide all record actions.

## Elevation & Depth

Borders and solid tonal layers establish depth. Custom SVG illustrations depict a physical routing desk and an agent processor. Their material shading belongs to the illustrations, not the application surfaces. Card hover uses a thin colored inset and restrained shadow without moving controls. No ambient light pools.

## Shapes

6px controls, 10px dialogs, compact rectangular nodes with visible input/output ports. Pills are status markers only. Ports are circles because they represent connections.

## Components

Shared Button/Input/Textarea/Select/Dialog primitives remain canonical. Controls have visible hover, keyboard focus, disabled and busy states. Sonner owns notifications. The ConfirmAction provider wraps the existing Radix AlertDialog for risky actions. SecretInput owns masked inputs and reveal controls. Search uses an explicit clear action; dataset lists use a 12-record client page over the existing full-list API.

Token mapping: colors.background → --background → bg-background/body; surface → --card; primary → --primary and --ring; signal → --desk-signal; muted → --muted-foreground; border → --border. Typography → --font-ui/--font-display/--font-data. Shared primitives and feature CSS consume these adapters.

Lucide icons at 16–20px, 1.5–2px strokes. The user's follow-up requests more imagery and animation: app/visual-effects.css is the canonical motion layer, using --motion-fast (160ms), --motion-enter (420ms), and --motion-ease. Static authored SVG images in public/illustrations are reused by WorkspaceArtwork. Illustrative signal paths move across those images; saved-route previews animate only on hover/focus and identify themselves as previews. Cards enter once with a small stagger; dialogs/tools use brief transitions. All cosmetic motion respects reduced motion and the saved motion preference, with pause controls on desktop, mobile navigation and auth. Real execution indicators remain separate; no fabricated metrics or execution activity. Offline worker status remains visible and actionable.

## Do's and Don'ts

- Do make a real saved route the main visual object.
- Do keep Save, Run workflow and Activate distinct: each changes a different state.
- Do preserve tenant isolation, encrypted credential handling and revision conflicts.
- Don't invent a linear sequence where branches exist; label branching explicitly.
- Don't hide actions behind hover or communicate execution status with color alone.
- Don't reintroduce gradient backgrounds, fake waveform illustrations or oversized icon cards.
