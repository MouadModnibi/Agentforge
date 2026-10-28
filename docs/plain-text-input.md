# Plain-text workflow test input

Text-only manual workflows open the Test drawer in Plain text mode. Paste an entire job description or message directly; parseRunInput wraps it as the text field without rewriting content. JSON mode remains available for extra fields. Each mode keeps a separate in-memory draft. Invalid input is focused and explained inline before a save or execution request.

Verification (2026-10-28): all 160 tests pass, typecheck/build pass, lint has zero errors and 18 existing warnings. Tests cover multiline French offers, quotes/bullets, literal JSON pasted as text, structured JSON compatibility, empty/invalid inputs and mode defaults.

Browser checks used an isolated local QA database and the production build. Verified automatic Plain text mode, multiline paste, enabled execution after nonempty text, JSON mode, actionable inline malformed-JSON error/focus, and preserved text after switching back. No AI call or real workflow execution was performed. Desktop/mobile screenshots: plain-text-input-desktop.png and plain-text-input-mobile.png. Phone viewport 390x844 retained readable input and scrollable tools; viewport override reset after testing. The temporary QA server was stopped; the user's existing local dev app remains running.

Strict static audit is saved in plain-text-input-audit.json. Existing component-wrapper false positives remain as documented in design-review.md/pdf-downloads.md; this change reuses the existing Textarea and Button owners. No tokens, navigation, backend routes or workflow graphs were changed.

Usage: refresh the local app, open the internship workflow, choose Test/Run workflow, keep Plain text selected, paste the complete offer and execute. For Vercel, deploy the updated application code; workflow re-import is not required.
