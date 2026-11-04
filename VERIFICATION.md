# Quick Mode implementation verification

Latest review: 4 November 2026. Earlier sections record their original checks. This records checks actually performed; it is not a certification or a completed analyst pilot. Research requirements in the original acceptance checklist are intentionally outside this implementation's scope.

## Automated checks

- `npm run check`: zero Svelte/TypeScript errors or warnings.
- `npm test`: 50 tests across three suites, including batched driver-assessment regressions.
- Static production build succeeds, including a `/scenarios` base path and generated service worker. The root-path static build was also exercised during implementation.

Tests cover per-axis medians (5/4/2 → 4 and 3/4 → 3.5), missing and invalid scores, explicit unresolved values, versioned import validation, invalid analytical references, credential-field exclusion, immutable chain snapshots, hypothesis histories and downstream review notices. They also cover independent contexts and exact model IDs, no research tools, partial failure/retry lineage, malformed outputs, changes during in-flight requests, cancellation, budget reservation, unknown charges and interrupted-run recovery. Consolidation tests verify that suggestions are advisory, cross-uncertainty merges are rejected, and acceptance preserves archived records and provenance.

Assessment regression tests cover 0/10/11/44 drivers, identical ten-driver batches across models, complete model/run attribution, aggregate budget admission and reservation, two-request concurrency, incremental results, cancellation during response downloading, failed-batch retry and replacement scopes, legacy retries and metadata round trips. Response tests distinguish output-limit truncation (including empty/null content), JSON syntax, schema validation and provider failures, and exercise strict-schema, JSON-mode and prompt-only request formats.

## Browser checks

Exercised in the available desktop Chromium automation browser. Actual screen sizes: 1024×900, 1280×960 and 1440×1000, plus a 640px-wide desktop viewport for reflow. Browser user agent can be recorded from the QA artifacts when repeating these checks; Firefox, Safari and Edge have not been independently tested.

- Inspected Common Ground home, chain comparison and narrative editor screenshots in light appearance, and the chain screen in dark appearance.
- Confirmed document width stays within the viewport at the checked laptop widths and at 640px. Wide chain comparisons scroll within their own region rather than widening the document.
- Inspected cells and changed a selected hypothesis to `Unresolved`. Earlier coherence notes, chain snapshots, original content and approvals remained distinguishable. No OpenRouter requests were made by editing, approving, selecting drafts or completing the exercise.
- Used Enter and Space to inspect coincident matrix points, cycling from Household energy to Housing access without changing their plotted coordinates.
- Approved three chains, chose three authored initial drafts, edited a narrative and completed with all checklist items unchecked.
- Confirmed rich-text → Markdown → rich-text round trips preserve supported bold formatting. The original draft, working text and final snapshot remain separate.
- Refreshed and reopened the saved exercise. Fixed a reactive-object cloning issue found in resume/split operations during this review.
- Loaded OpenRouter's real public model catalogue from the browser; catalogue requests and prices are integrated. **No paid authenticated inference calls were run.**
- Downloaded PDF, DOCX and resumable project JSON through the UI. Imported the backup into a fresh production-preview browser origin; decisions, narratives, revisions and unresolved choices were restored.
- Served the production build at `/scenarios/`. Confirmed service-worker activation at that scope and offline cache population. Reloaded the imported project offline, opened the lazy-loaded editor, edited saved text, used exercise undo/redo and restored the edit after a reload. No OpenRouter entries appeared in the application cache.
- Injected a simulated IndexedDB quota failure in the QA browser. The app displayed `Changes not saved`, did not falsely display `Saved on this device`, kept the working text, and successfully saved it after restoring storage and activating `Retry save`.
- Browser console checks on the exercised production path reported no errors or warnings.

The assessment fix was also exercised in desktop Chromium against the development server with all OpenRouter traffic intercepted. A 44-driver assessment showed five batches per model and 15 requests in its confirmation dialog. A simulated truncated batch retained its raw text, completion reasons, token usage and cost while the other 14 batches succeeded. Choosing a replacement model with complete coverage reduced the scope and estimate to zero and disabled dispatch. Retrying the original model sent exactly one additional ten-driver request; all 44 drivers then had three ratings. IndexedDB retained all 16 runs and the truncation diagnostics after reload. The dialog and operation records were visually inspected; console checks reported no errors or warnings. These were mocked calls, not paid provider validation. Screenshots are saved as `output/playwright/assessment-batch-confirmation.png` and `output/playwright/assessment-truncated-batch.png`.

Keyboard semantics, labels, visible focus, native table controls, modal focus return, status announcements and reduced-motion rules are implemented. These checks do **not** replace a complete keyboard-only/screen-reader audit. The 640px reflow exercise is not a claim of testing every control with actual 200% browser zoom.

## Model activity update — 3 November 2026

- Added six focused unit tests for request/batch counts, history grouping, partial failure, read/dismissed preferences, transitions, cancellation, exercise isolation and preserved financial records. The suite now contains 92 passing tests across four files.
- Exercised real orchestration in desktop Chromium with all OpenRouter traffic mocked: two running/one queued requests, queue advancement, partial success and rate limiting, unread results, completion while the popup is open, and cancellation before the third request dispatches. No paid calls were made.
- Checked full-record links, expansion and focus on the target stage; Escape/focus return, Enter/Space, Tab and outside dismissal; persistent clearing, exercise isolation, reload interruption and preserved unknown-charge distinctions. Simulated a preferences-only storage failure and verified that local clearing still works with an explanation that it could not be remembered.
- Inspected light/dark appearances, long model names and diagnostics, laptop widths (1024/1280/1440), 640px reflow and 200% text enlargement. Checked reduced-motion popup and spinner styles. The popup and trigger also stay within a 360px viewport; unrelated existing workspace content can overflow at that unsupported phone width.
- QA scripts and screenshots are under ignored `output/playwright/model-activity-*`. Browser checks cover Chromium; the existing cross-browser/screen-reader release checks still apply.

## Construct Chains fixes — 3 November 2026

- `npm run check` passes with zero errors or warnings; all 108 tests across four files pass; the static production build succeeds.
- Added chain regressions for 1/0, 2/1 and 12/6 main/wildcard targets, independent batch contexts, exact request estimates, catalogue completion limits, strict schemas with approved driver/hypothesis pairs, missing/duplicate/invalid references, batch count/kind validation, explicit nulls, scoped retries/replacements, legacy retries, budget admission and changed inputs. Version 1.0 project round trips retain `quick-3` runs and chain batch metadata.
- Exercised both reported failure patterns in desktop Chromium with all OpenRouter traffic mocked. Two models each requested two main chains and one wildcard, using four requests. An incomplete wildcard and an output-limited wildcard both failed while four valid main chains remained available. Each explicit retry sent only its failed wildcard batch, leaving six candidates and six operation records. Raw responses, original failures, confirmed charges, unresolved cells and unscored/unapproved novel drivers survived saving and reload.
- Checked the launch dialog's four-request count and 16,000-token maximum allowance, then the truncated wildcard retry's one-request count and increased 24,000-token allowance. Reviewed light/dark screenshots at 1280px and the dark dialog at 640px; text and controls fit within the dialog. Screenshots and QA scripts are under ignored `output/playwright/chain-fixes-*`.
- These are mocked transport and browser checks; no paid inference calls or provider reliability evaluation were performed.

## Human-first scenario writing — 4 November 2026

- `npm run check` passes with zero errors or warnings; all 134 tests across five files pass; the root-path static production build succeeds.
- Added regressions for human drafts without a chosen model draft, empty/whitespace and multi-scenario progress, approved-chain requirements, continued editing after upstream changes, immutable human originals, legacy version 1.0 originals, proposal application/dismissal/staleness, undo/redo, exports and backup round trips. Mocked editing requests cover instructions and estimates, explicit application, changed inputs during inference, failure/retry with current prose, provider response formats and optional initial generation.
- Completed a human-only browser path with three scenarios, reload/autosave, rich-text/Markdown formatting, undo/redo, review with every advisory box unchecked, final completion, and Markdown/DOCX/PDF downloads. No OpenRouter requests were made and no API key was entered for this path. Clearing a narrative during review kept the editor available and disabled completion.
- Exercised five mocked model calls across writing and review: an accepted edit, a dismissed generated draft, a stale edit after continued typing, a malformed response and its explicit retry. Responses did not replace working prose automatically; applying an edit retained undo/redo. The retry retained instructions and used the latest text. Original human prose, working text, accepted/dismissed/pending proposals, run records and costs survived JSON round trips and browser reload.
- Restored the original human snapshot only after confirmation, then recovered the prior working text through Undo. Inspected the editor at 1280px and 360px, the AI preview in light appearance and the review/snapshot workspace in dark appearance. Document width stayed within 360/640/1024/1280px viewports, and AI help opened with the keyboard. No application runtime exceptions were observed. These checks do not replace the remaining cross-browser/screen-reader audit.
- QA scripts, screenshots and downloads are under ignored `output/playwright/human-writing-*`. All authenticated model traffic in these checks was intercepted; no paid provider calls were made.

## AI proposal attention — 4 November 2026

- Added a persistent bottom-of-viewport notice for pending AI drafts and edits, with scenario names, pending counts, matching scenario-tab badges and a keyboard-accessible jump to the proposal heading. Results do not steal focus while the analyst writes. Notices clear when proposals are applied or dismissed and survive reload through the existing proposal records.
- Exercised two mocked requests, including completion while viewing another scenario, jump/heading focus, application and dismissal. Checked multiple pending scenarios after reload, Enter activation, reduced-motion scrolling, light/dark appearances and the compact 360px layout. Browser checks reported no application runtime exceptions. Screenshots and QA scripts are under ignored `output/playwright/proposal-attention-*`.
- `npm run check` passes without errors or warnings; all 134 tests pass; the production build succeeds. No paid inference calls were made.

## Export checks

The browser-generated PDF was inspected using Poppler and pypdf. It was a two-page A4 document with embedded Nunito Sans, readable text and page numbering. The first page was rendered and visually reviewed: no clipping, missing glyphs or overlapping text were observed. Extracted text retained the manually added note and `Unresolved uncertainties: Income support`. The DOCX ZIP contained a well-formed `word/document.xml`; a full Word/LibreOffice rendering review remains to be completed. The JSON backup contained all three narratives and three chains; all advisory checklist arrays were empty.

Artifacts generated during QA are ignored under `output/playwright/`; the application does not depend on them. Examples include `home.png`, `chains-light.png`, `chains-1024.png`, `chains-dark-1280.png`, `narrative.png`, `scenarios.pdf`, `scenarios.docx` and `roundtrip.scenario.json`.

## Remaining release validation

1. Run authenticated browser-to-OpenRouter calls from the deployed GitHub Pages origin, using the selected models and a spending-limited key. Check CORS/preflight, model-specific JSON behaviour, complete large rating batches, returned usage costs and insufficient-credit responses. Transport behaviour is covered by mocks, not a paid live-model evaluation.
2. Run the full Chrome/Firefox/Safari/Edge and keyboard/screen-reader checks in `design/ACCEPTANCE.md`, including real 200% zoom, long labels, 1/3/7 scenarios and 2/5/9 uncertainties. Current reflow checks cover representative layouts, not this entire combinatorial set.
3. Visually review DOCX and longer full-record PDF exports, non-Latin text coverage and extreme paragraph/heading lengths. Narrative PDF rendering was verified; arbitrary documents are not guaranteed by one fixture.
4. Complete the five-analyst pilot and assess methodological quality, information density and the model ensemble. Agreement is never treated as proof, and scenario outputs are not forecasts.
5. Review dependency advisories before public release. Installation resolved the reported critical/moderate PDF and test-runner issues; six low-severity upstream framework/tooling advisories remained at the recorded installation. No automatic major-version migration was performed.

The GitHub Pages workflow is prepared but no remote commit, repository settings change or deployment was performed. Git status/diff commands were unavailable in this host because its Apple command-line tools require Xcode licence acceptance; application builds and browser checks were unaffected.
