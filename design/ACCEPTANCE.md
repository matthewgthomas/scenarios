# Common Ground implementation acceptance

Use with [DESIGN.md](../DESIGN.md) and [spec.md](../spec.md). These checks describe the app to build; they are not claims that the reference implements them. Record browser, viewport, keyboard/screen-reader setup and any exceptions during review.

## Visual and layout checks

- [ ] The shell, typography, palette, scenario header shapes and contextual inspector are recognisably Common Ground. Other concept themes have not been mixed into the interface.
- [ ] Shared values come from `tokens.css` or a documented mapping to equivalent tokens. Actual component foreground/background combinations meet the applicable contrast requirements.
- [ ] Essential table, navigation and control text is at least the 14px baseline; secondary metadata is at least 12px. Text scales with browser preferences.
- [ ] At 1024, 1280 and 1440px, the main task and stage action are usable, long labels wrap and the page has no unintended horizontal scrolling.
- [ ] At 200% zoom, navigation, score editing, hypothesis editing and approval remain available. A desktop user is not rejected as a mobile device merely because their viewport is narrower.
- [ ] Additional scenario columns scroll within the comparison region; uncertainty labels and column names stay understandable. Test 1, 3 and 7 scenarios; 2, 5 and 9 uncertainties; and 100-character titles.
- [ ] Light and dark appearances preserve text contrast, selection, status, focus and scenario identity. Colour does not carry meaning alone.
- [ ] Sticky elements never obscure focused controls, the last row or the footer. Layout grows with content; the prototype's artificial minimum height is absent.
- [ ] Motion explains an interaction, stops under reduced-motion preferences and does not delay editing.

## Analyst ownership and the combination screen

- [ ] Selecting a cell updates the inspector for the correct stable combination/uncertainty IDs. Selection survives sorting and does not imply approval. (FR-14)
- [ ] The grid and detail view read/write the same hypothesis reference. Long hypothesis descriptions remain available without hover. (FR-14)
- [ ] Each combination has one hypothesis per selected uncertainty unless explicitly `Unresolved`. An unresolved option remains visible in drafting and export. (FR-13, FR-19)
- [ ] Editing a hypothesis preserves earlier content and reasoning, identifies affected downstream work and makes **zero model calls**. Record a network trace for this test. (FR-15, FR-28)
- [ ] Old coherence notes show their revision/time and `Review suggested` after an applicable edit. They do not appear freshly checked. (FR-15)
- [ ] No coherence recheck action or historical-run retry is offered. Earlier reasoning stays readable, and editing and approval make zero model calls. (FR-15, FR-30)
- [ ] Any valid selection of one or more combinations can proceed to writing, without scenario targets or main/wildcard categories. Empty selections explain the minimum requirement. Standard generation offers three candidates per model; optional disruption exploration offers one. (FR-16)
- [ ] An additional disruption driver is explicitly accepted or removed and remains visibly unscored unless actually scored. (FR-17)
- [ ] Approval applies to the intended selected combinations, records the correct revision and remains reversible. Approval does not initiate drafting or rechecking. (FR-13, FR-15, FR-28)
- [ ] Model names/IDs and genuine reasoning replace all example A/B/C labels and generic text. The interface never describes agreement as proof. (FR-04, FR-13)

## Driver assessment and hypotheses

- [ ] The axes read humanitarian impact and uncertainty, use the 1–5 anchors, and never imply probability or a 2×2 scenario method. (FR-08, FR-09)
- [ ] For impact scores 5/4/2, the provisional median is 4 and all three positions/explanations are inspectable. For two valid scores 3/4, preserve 3.5 rather than rounding. (FR-09)
- [ ] Missing/invalid ratings are visibly missing/invalid, not zero or silently coerced. A partial model set does not appear complete. (FR-08, FR-31)
- [ ] Both a keyboard user and a pointer user can inspect and override a score. The table and plot stay in sync. (FR-09, FR-10)
- [ ] Bulk acceptance is explicit and records `bulk_accepted_median`; individual adjustments record `explicitly_edited`. (FR-10)
- [ ] The disagreement queue explains its prioritisation, provides sorting and does not call its threshold scientifically validated. (FR-10; spec §7.3)
- [ ] Unique model contributions survive consolidation; merge/split actions preserve original attribution. (FR-06, FR-07)
- [ ] Critical uncertainty selection recommends 4–6 without enforcing that count or requiring a causal map. (FR-11)
- [ ] Hypotheses are distinct future states, with a variable number per uncertainty and full add/edit/merge/split/remove controls. (FR-12)

## Research and writing

- [ ] Research Mode independently discovers evidence, consolidates it, and presents an explicit evidence approval checkpoint. (FR-24–26)
- [ ] Sources expose provenance, verification status and supporting claims. An inaccessible source is not shown as verified. (FR-25)
- [ ] Later research requests state the question, expected usefulness and estimate; no request starts before approval. Changed evidence flags affected decisions without overwriting them. (FR-27)
- [ ] Quick Mode contains no invented citations. Annotation types distinguish historical evidence, assumptions/hypotheses and imagined futures. (FR-22)
- [ ] Writing opens an empty editor with combination guidance. Human-only drafting through review, completion and export works without a model key. Optional generated starting drafts remain inside collapsed AI help. (FR-18)
- [ ] Rich-text and Markdown edits preserve supported formatting and make no AI calls. Optional whole-scenario editing accepts instructions and returns a proposal to explicitly apply or dismiss. Changed text or combination revisions prevent applying stale proposals. (FR-20)
- [ ] Original human or accepted AI draft, working text and final snapshot are distinguishable. Applying a proposal and restoring snapshots preserve previous working text through Undo. Every selected scenario needs non-empty text to review and complete. (FR-21)
- [ ] Evidence annotations are off by default. Editing affected text marks broken/detached anchors for review rather than leaving misleading citations. (FR-22)
- [ ] The advisory checklist can be entirely unchecked without blocking completion/export or triggering an extra AI critique. (FR-23)

## Failure, spending and persistence

- [ ] Two successful model results remain visible when the third fails. Retry targets failed work; replacement is explicit; proceeding partially preserves the missing-contribution record. (FR-31)
- [ ] Per-model states cover queued, running, succeeded, failed and cancelled. Cancellation prevents new queued calls and does not promise refunds for dispatched calls. (FR-31; spec §7.3)
- [ ] Confirmed, estimated, reserved and unknown costs are distinct. Budget warnings do not promise a hard external cap. (FR-30)
- [ ] An operation exceeding estimated remaining budget is blocked pending an explicit budget/model adjustment. Existing successful results remain intact. (FR-30)
- [ ] A save failure does not display `Saved on this device`. The analyst can retry or back up work. A refresh restores the last durable state. (FR-05)
- [ ] Offline editing of saved content works; AI operations explain their connection requirement. In-flight work interrupted by refresh is reported accurately. (FR-05, FR-31)
- [ ] A portable project restores decisions, edits, approvals, sources and provenance in another browser. No API key appears in project files, URLs, logs or exports. (FR-05, FR-29, FR-32)
- [ ] Users can copy/download narratives and export the full report, analytical JSON and resumable project JSON. Annotation inclusion is explicit; exported layout and links are checked. (FR-29)

## Accessibility and pilot review

- [ ] Complete the main path using only the keyboard; repeat matrix editing, combination editing and evidence inspection with a screen reader.
- [ ] Landmarks, headings, table captions/headers, labels and focus order are meaningful. Dialogs/popovers return focus, and state updates do not drop it.
- [ ] All colour encodings have text/shape equivalents; every hover-only detail has a keyboard and touch equivalent.
- [ ] Status messages announce approval, save and failure changes without repeatedly announcing streaming text or hover.
- [ ] Test Chrome, Firefox, Safari and Edge. The reference's browser check is not a substitute for production compatibility testing.
- [ ] In the five-analyst pilot described in the spec, check whether users can explain provisional medians, model disagreement, analyst approval, unresolved hypotheses and explicit paid actions without prompting. Revise the relevant UI if they cannot.

## Handoff checks already performed

The accompanying reference was visually inspected and exercised for cell inspection, model-perspective switching, unresolved hypothesis selection, approval and undo. The token pairs were checked numerically for intended text and control contrast. See [reference/README.md](reference/README.md) for the exact scope and limitations. Production functionality and accessibility still require the checks above.
