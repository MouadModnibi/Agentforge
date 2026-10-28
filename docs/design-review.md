# Signal desk redesign review — 27 October 2026

## Intent and implementation

This product helps people route events through agents and connected services. Its visual signature is the saved workflow topology: amber trigger ports, blue-grey process nodes, explicit branch labels and restrained wiring. Condensed headings and monospaced operational details sit on solid graphite surfaces. No ambient gradients, fake model diagrams, card entrances or idle execution animations remain in the active theme.

DESIGN.md records the visual system; UX-CONTRACT.md records component ownership and interaction choices. app/signal-desk.css owns the shared identity, with scoped workflow/editor/account layouts. Fontsource fonts are bundled locally. Existing routes, API behavior, encrypted credentials, account ownership, revisions and workflow execution remain intact.

## Browser coverage

Reviewed in the in-app browser at its desktop viewport (approximately 1280 × 720) and 390 × 844, using the existing signed-in workspace.

| Area                | Checks and outcome                                                                                                                                                                                                                                    |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workflow collection | Actual saved node topology; all/active/draft counts; search no-results; clear action restores input focus; gallery/table controls; mobile creation actions stack deliberately.                                                                        |
| Canvas              | Central React Flow canvas, right tool panel, category labels, node/connection ports; mobile starts with tools closed; opening/closing and no-result node search recover correctly. Document width equals viewport width after tab-spacing refinement. |
| Agents              | Prompt-led cards and data table; model and run metadata; Radix sort popup measured 144px, matching its 144px trigger. Escape closes the popup.                                                                                                        |
| Agent studio        | Configuration navigation, General and Prompt sections; phone form scrolls naturally and has no horizontal overflow. Model and token inputs have associated labels.                                                                                    |
| Playground          | Empty output/input/history layout, output tabs, existing provider notice and main Run action. No agent was run for design verification.                                                                                                               |
| Credentials         | Table and security explanation; phone dialog fits viewport; secrets masked; labels exclude reveal-button text. Empty name and missing connection fields show associated errors and focus the first invalid input. Dialog cancellation restores focus. |
| Registration        | Desktop example-route panel and form; phone form; blank submission shows textual field errors, aria-invalid and first-error focus. No account was created.                                                                                            |
| Settings            | Account/profile section and Gemini connection; loading/connected states; Remove key opens an AlertDialog with Cancel initially focused. Escape cancels and returns focus to Remove key. The key was not changed.                                      |
| Navigation          | Mobile navigation uses a dedicated shared Dialog variant with focus trapping, Escape and restoration. Drawer bounds measured x=0, y=0, width=320, height=844 on the 390px viewport.                                                                   |

Refinements made after browser critique: mobile primary creation button gets a full row; the canvas initially prioritizes the graph on phones; editor tabs no longer overflow; navigation no longer inherits the centered dialog translation; credential controls avoid login autofill and nested button/label names. Idle connection motion is removed, while real running status and reduced-motion support remain.

## Checks

- Existing suite: 141 tests passed across 16 files. Tests isolate data and preserve account/workflow boundaries.
- Production build and standalone TypeScript check passed. Next route types were regenerated after adding route metadata.
- ESLint: zero errors, 18 warnings in the existing codebase, including deliberate full navigations that clear account caches.
- The official designmd linter passed with zero errors and zero warnings.
- Strict premium audit was expanded to app/ and components/. Its raw report is premium-audit.json. The auditor treats capitalized React components as literal HTML, so 20 findings were manually reviewed: 6 Button wrappers delegate to Radix Trigger/asChild or a real Link; 14 Textarea uses delegate to components/ui/textarea.tsx, whose canonical resize-none rule is also reinforced by product CSS. These are static-analysis false positives, not missing actions or resizable inputs. The report is retained rather than hidden with exclusions or no-op handlers.

## Limits

This is practical visual and keyboard review, not a complete accessibility certification. Real phone touch keyboards, a full 200% zoom matrix and every execution failure mode were not exercised. Loading, no-results, validation and confirmation cancellation were checked in the browser; existing automated tests cover backend success/failure and ownership paths. The email worker was kept offline, and no live connector action, real workflow mutation, key removal or deletion was performed during review.

Screenshots are saved beside this report: [desktop workflows](design-workflows-desktop.jpg) and [mobile workflows](design-workflows-mobile.jpg). They contain only the local app views, with no secret values revealed.

Final browser pass also verified client-side collection-state restoration by navigating Workflows → Agents → Workflows with a search active; the search and matching results returned. The custom 404 screen offers a working return to workflows. Browser console checks returned no errors or warnings.

## Requested illustration and motion follow-up

The user requested images, animation, and visual effects after the initial redesign. Added two original local SVG images: an isometric routing desk and an agent processor. WorkspaceArtwork reuses them on Workflows, Agents, and desktop auth, reserving their dimensions and loading the above-the-fold assets eagerly. app/visual-effects.css owns short card entrances, panel/dialog transitions, material hover feedback, and illustrative signal paths. Saved route signals animate only on hover or keyboard focus, with a Route preview label. Execution status remains separate.

Browser checks covered 1280 × 800, 390 × 844, and a 320px viewport. No document overflow was measured. The mobile agent filter bar was refined into full-width search with sort/view controls below it. SVG images reported loaded with their reserved dimensions. Keyboard focus on a workflow activated its preview signal; inactive previews remained stopped. Pausing changed all decorative signals to animation:none and opacity:0; resuming restored motion. The same pause control was checked in mobile navigation and on auth. Reduced-motion CSS is present; the operating-system preference itself was not changed during review.

All 141 tests pass; standalone typecheck and production build pass. ESLint remains at zero errors and 18 existing warnings. The official designmd linter reports zero errors/warnings. Strict premium audit retains the same 20 reviewed component-wrapper false positives documented above, with no new finding category. Browser review found Next image loading warnings, resolved by loading these above-the-fold SVG assets eagerly.

New evidence: [desktop effects](design-effects-desktop.jpg), [mobile effects](design-effects-mobile.jpg), and [illustrated auth](design-effects-auth.jpg). The app was left on Workflows with animation enabled after pause/resume verification. No workflow or credential was changed.
