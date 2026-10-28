# m8m frontend

m8m uses the **Signal desk** design system: solid graphite surfaces, locally bundled IBM Plex UI/data typography, Barlow Condensed headings, and amber trigger ports. Actual workflow routing is the main visual signature. See [DESIGN.md](../DESIGN.md), [UX-CONTRACT.md](../UX-CONTRACT.md), and [the browser review](design-review.md).

## Structure

- `WorkspaceShell.tsx` owns shared navigation, account actions, command search and a mobile Radix navigation dialog. The canvas uses a compact rail.
- `WorkflowsPage.tsx` presents saved workflows as route strips or a table. `WorkflowRouteStrip.tsx` draws saved edges, explicit branch labels, and at most four preview nodes; larger graphs are labelled as partial previews. The full React Flow editor remains central with tools on the right.
- Agents use instruction excerpts, model metadata and run counts. The studio keeps configuration navigation separate from the form. The playground places inputs/history beside the main output.
- Credentials use a table, service guidance and a validated dialog. `SecretInput` owns masking/reveal controls. `ConfirmActionProvider` uses Radix AlertDialog for workflow deletion, retries, version replacement and key removal.
- List search/filter/sort/view/page state survives client navigation through `useCollectionState`, in memory only. It clears on full navigation/auth changes. Existing full-list APIs are rendered in pages of 12 records.

## Style ownership

`app/signal-desk.css` owns the shared tokens and identity. `app/globals.css` retains Tailwind adapters and established shell/agent geometry. `app/workflows.css` owns editor geometry; `app/workflow-overview.css` owns collections; `app/accounts.css` owns auth/settings. `app/motion.css` is retired and not imported. `app/visual-effects.css` adds authored isometric SVG illustrations, illustrative signal paths, keyboard/pointer route previews, short card entrances, and panel transitions. Shared MotionToggle controls are available on desktop, in mobile navigation, and on auth screens. Reduced motion takes precedence. Illustration and preview motion never announce a real execution.

The existing routes, database integration, tenant isolation, draft storage, encrypted credentials and revision behavior are preserved. Run the UI with `npm run dev`. Start `npm run worker` separately only when you intend active automations to poll their services. The worker is intentionally not started for visual review.

## Verification

Use `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. The review document records desktop/mobile coverage, refinements, exact outcomes and static-audit limitations. Browser checks avoid executing real connectors or changing saved workflows.
