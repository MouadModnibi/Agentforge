# Workflow PDF downloads

Completed string outputs now display as readable text with Download PDF and Edit for PDF controls. The same WorkflowTextOutput component owns the final execution result and selected-node output. Structured JSON keeps its original inspector. PDF edits are local to that preview; saved executions are not mutated.

PDF generation uses a lazy-loaded pdf-lib module in the browser, with no extra model call, upload, server storage or new API route. It produces A4 documents with measured word wrapping, long-word splitting and multi-page continuation. French/English accents are supported by Helvetica. Empty text, text above 50,000 characters, unsupported symbols and remaining [REDACTED] markers produce actionable errors. Secret redaction remains intact; a download never tries to recover hidden credential values. Review notes can be removed with Edit for PDF before downloading a letter.

Validation on 2026-10-28:

- 155 tests passed, including real PDF parsing, French accents, page dimensions, pagination, long URLs, limits and redaction checks.
- Typecheck and production build passed. Lint has zero errors and 18 existing warnings.
- Isolated local QA database at data/qa/pdf-download.db; no real account/workflow modified, no AI or Telegram action executed. Browser verified disabled download on redacted output, editing contact text, enabled download and an actual PDF download. pypdf confirmed French accents and corrected text in the downloaded file. Screenshot: pdf-download-desktop.png.
- The provided Amadeus letter was separately generated as a one-page PDF, visually inspected and checked for intact contact information and exclusion of the review note.
- Strict UI audit saved in pdf-premium-audit.json: 21 component-wrapper false positives (the 20 documented in design-review.md plus the new shared Textarea using the same canonical resize-none primitive). No new finding category. Narrow-screen browser verification was not performed for this change; action controls use existing responsive primitives and flex wrapping.

Deploy the updated code and dependency lockfile to Vercel before expecting the button in the cloud app. Existing completed text executions can be downloaded without rerunning Gemini. The generated personal PDF and private QA data are excluded from Git.
