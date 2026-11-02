# Quick Mode implementation verification

Review date: 2 November 2026. This records checks actually performed; it is not a certification or a completed analyst pilot. Research requirements in the original acceptance checklist are intentionally outside this implementation's scope.

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
