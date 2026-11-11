# Scenario Designer: Common Ground

Frontend design handoff · 1 November 2026

**Selected direction:** Common Ground, chosen by the product owner from the three concept previews. Build a welcoming, precise workspace in which a humanitarian analyst can examine different futures and retain ownership of every decision.

## Start here

1. Read [spec.md](spec.md) for product behaviour, methodology and scope.
2. Open [the interactive Common Ground reference](design/reference/common-ground.html) in a browser. Its data and actions are illustrative. [The screenshot](design/reference/common-ground.png) is available without running anything.
3. Use [tokens.css](design/tokens.css) for the implementation's shared visual values.
4. Use [the acceptance checklist](design/ACCEPTANCE.md) to review the implementation and its important states.

`spec.md` takes precedence on functionality. This document defines the visual and interaction direction. The tokens are the implementation baseline; the reference demonstrates composition and character, not production architecture or complete functionality.

The selected concept establishes the evergreen sidebar, pale green workspace, humanist typography, softly coloured scenario headers, aligned hypothesis cells and contextual reasoning panel. The additional screen designs below are implementation recommendations derived from that direction and the spec. They have not yet been tested with analysts.

## 1. Character and design principles

**A welcoming workshop for serious thought.** The experience should feel calm, capable and intellectually engaging. The pleasure comes from discovering an unexpected relationship, understanding a disagreement, making a considered choice, and seeing work remain safely editable.

- Give the analytical material most of the screen. Use a stable shell and progressively disclose detail.
- Make alternatives easy to compare. Alignment and consistent identities carry more meaning than decoration.
- Keep the analyst's decisions distinct from model suggestions. Approval indicates ownership, not objective truth.
- Treat disagreement as useful information. Explain the difference before asking the analyst to resolve it.
- Keep affected people visible through clear analytical language. Avoid emotive crisis imagery, institutional emblems, gamified scores, confetti and anthropomorphic model avatars.
- Make every paid action deliberate. Editing, browsing reasoning, changing views and moving between completed stages must not initiate model calls.

Common Ground is the sole interface direction. Do not introduce Fieldnotes' lilac shell or Signal Atlas' blue instrument-panel layout as additional app themes. Light and dark appearances should retain the same Common Ground identity.

## 2. Visual system

### Colour

Use semantic tokens, not scattered hex values. The light palette below matches the selected concept; dark counterparts are in `tokens.css`.

| Role | Light value | Use |
| --- | --- | --- |
| Workspace | `#F3F7F4` | Main work surface behind analytical content |
| Paper | `#FFFFFF` | Editable cells, inspector, forms and writing surface |
| Primary text | `#233D33` | Headings, body text and values |
| Secondary text | `#546B60` | Helpful metadata and supporting instructions |
| Evergreen | `#245C47` | Primary action, selected border and active controls |
| Sidebar | `#244C3C` | Persistent navigation |
| Selected surface | `#E6EFE8` | Selected cell or control, paired with an evergreen border |
| Scenario sage | `#E0ECE4` | First scenario's identifying header |
| Scenario river | `#E1EAF3` | Second scenario's identifying header |
| Scenario wheat | `#F4EBCE` | Third scenario's identifying header |
| Decorative rule | `#DBE5DD` | Nonessential separators |
| Control boundary | `#71877A` | Input and secondary-button boundaries |
| Review surface / text | `#FCF5DF` / `#715B24` | Changes or assumptions needing attention |

Scenario colours indicate identity, never optimism, severity, likelihood or quality. Assign a colour to a stable scenario ID and retain it when columns are reordered, renamed or exported in colour. Additional scenario colours are supplied, but colour is never the only identifier. Always show the scenario name. Disruption exploration adds candidates to the same list without a separate category badge. More than six scenarios may reuse colours with distinct names.

Model identities use a separate small set of marks: circle, square, triangle, then additional distinguishable shapes. Pair every mark with the actual model name. Do not equate a scenario colour with the model that proposed it. PESTLE tags remain quiet text or neutral labels, and a driver may have several tags or none.

Reserve status colours for status. Use red for actionable errors and destructive actions, amber for review, and green with a check for recorded analyst approval. A model disagreement is not automatically an error. Decorative separators are intentionally subtle; they are not sufficient boundaries for form controls. Validate actual text/background and control/background combinations in both appearances.

### Typography

Use **Nunito Sans** throughout the interface, including headings. Its open shapes and restrained roundness provide warmth without making the workbench childish. Self-host the required font files with their accompanying licence in production; include system sans-serif fallbacks and `font-display: swap`.

| Role | Size / line height | Weight |
| --- | --- | --- |
| Stage title | 32px / 1.2 | 750, or 700 if the delivered files lack that weight |
| Section heading | 20px / 1.3 | 700 |
| Scenario title | 18px / 1.3 | 700 |
| Form input and longer guidance | 16px / 1.5 | 400–600 |
| Interface body, table cells, navigation | 14px / 1.5 | 400–700 |
| Metadata and provenance | 12px / 1.45 | 400–600 |
| Narrative text | 18px / 1.7 | 400 |

These are the production baseline, expressed in `rem` in the tokens. The compact concept contains smaller labels; do not copy its 11px table typography into production. Never shrink text to fit additional scenarios. Permit wrapping, use an explicit compact spacing option, or scroll the comparison table horizontally.

Keep paragraphs at approximately 60–75 characters per line; narrative prose at approximately 65. Left-align text; right-align numeric columns with tabular numerals. Use sentence case and ordinary tracking. Avoid uppercase eyebrow labels, monospace metadata and decorative italic emphasis.

**Optional narrative refinement:** Literata may be used for long-form scenario prose while keeping all controls in Nunito Sans. This borrows the reading comfort of Fieldnotes without changing the selected shell. It is a proposed extension to review, not a second required font or an already approved screen.

### Spacing, shape and elevation

Use the 4px spacing scale in `tokens.css`: 4, 8, 12, 16, 20, 24, 32 and 40px. Main work areas use 24–32px padding. Keep related labels 4–8px from their content and separate analytical sections by 24–32px.

- Hypothesis cells: 6px radius, 12–16px padding, at least 64px tall, allowed to grow.
- Buttons and inputs: 8px radius, at least 40px high; 44px targets on coarse pointers.
- Inspector and bounded editors: 13px radius, 20–24px padding.
- Scenario headers: 13px top corners, 6px lower corners; generous space for wrapped names and state.
- Use a border and a filled surface for structure. Reserve the supplied shadow for floating menus and dialogs.
- Do not wrap every section in an identical card. Lists, toolbars and legends can sit directly on the workspace.

The rounded outer window and fixed minimum height in the reference are presentation framing. The production app fills its browser surface, grows with content, and has no arbitrary 1050px minimum height.

### Iconography and motion

Use one consistent outline icon family; the concept uses Lucide. Typical sizes are 16px for controls and 20px for navigation. Include visible action labels unless the meaning is established and an accessible name is provided. Model badges are attribution, not avatars. The branching product mark is provisional rather than a final logo.

Use 140ms for selection/hover feedback and approximately 200ms for opening a panel. Animate only in response to an action and only to explain a change. A selected matrix driver can reveal its model positions; a changed cell can briefly highlight the corresponding dependency notice. Honour reduced-motion preferences. No looping background animation or staged page-load reveals.

## 3. Application shell and navigation

At 1280px, use a 216px sidebar and a flexible work area with 32px padding. At 1024px, use a 184px sidebar and 24px padding. At 1440px and wider, use additional width for the analytical material rather than enlarging decorative chrome. Narrative reading remains width-limited.

```text
┌─────────────────┬──────────────────────────────────────────────┐
│ Scenario        │ Exercise title    Mode    Save state / tools │
│ Designer        ├──────────────────────────────────────────────┤
│                 │ Stage title and one useful instruction      │
│ Exercise        │ Local controls and progress                 │
│ Horizon         │                                              │
│                 │ Main analytical material                    │
│ Workflow stages │                                              │
│ and status      │ Contextual reasoning / evidence / editor    │
│                 ├──────────────────────────────────────────────┤
│ Models / spend  │ Decision summary       Stage action         │
└─────────────────┴──────────────────────────────────────────────┘
```

Keep the question and horizon inspectable from the exercise title. Show Quick/Research mode, truthful save state, and access to model settings, budget, project backup and exports. `Saved on this device` means the latest edit has actually been committed to IndexedDB; also implement saving and save-failure states. Local storage must not be described as confidential storage.

The sidebar exposes setup, the six named analytical stages from the spec, and export. Writing and final review share the “Write & review scenarios” workspace. In Research Mode, insert the evidence checkpoint after setup; do not invent a second numbered analytical methodology. Completed stages remain navigable. Use the stage names from the spec consistently, with numbers only for the actual ordered stages.

Display `Not started`, `Working`, `Complete`, `Review suggested` and `Blocked` with text and a distinguishable mark. The active stage has a wheat background and dark text. If a stage is unavailable, explain its unmet prerequisite. Navigation must not delete work, silently approve it or regenerate it.

Use a footer action region for a decision summary and one primary stage action. Approval and a subsequent paid drafting/generation action are separate operations. At comfortable heights the footer may be sticky; at short heights or high zoom it returns to document flow so it never obscures content or keyboard focus. Avoid multiple nested vertical scroll areas.

### Narrow screens and zoom

The product's MVP is desktop-only. Test 1024, 1280 and 1440px layouts and 200% text/browser zoom. Allow labels, toolbars and inspectors to reflow. Keep scenario comparison as a semantic, locally scrollable table with readable cells and visible row/column context; keep the rest of the page free of horizontal overflow.

On phones, provide the spec's clear desktop-use message. Do not use a viewport-width check to block a desktop user who has zoomed in. Essential saved-work navigation and controls must remain usable through reflow; the exact unsupported-device treatment needs browser testing. The responsive miniature in the reference makes the concept viewable and is not a mobile product specification.

## 4. Signature screen: construct combinations

This is the approved visual anchor. Use it to calibrate the component library before expanding to other stages. See FR-13–17 and FR-28 in the spec.

### Composition

- Rows are selected critical uncertainties; columns are candidate scenarios. Each intersection holds one future-state hypothesis, or an explicit `Unresolved` value.
- The uncertainty column is neutral. Scenario headers carry their stable soft colour, editable name, proposal/approval state and scenario-selection control.
- Keep hypothesis cells on white/paper surfaces. A selected cell receives the soft selected fill plus a visible evergreen boundary. Display full text with wrapping rather than relying on truncated text or hover.
- Put the reasoning/editor panel beneath the grid, as in Common Ground. It stays in context and has two columns at comfortable widths: reasoning on the left, hypothesis choice on the right. Stack it at narrower widths.
- Support any user-selected set of at least one combination. The reference's three columns and five uncertainties are examples, not caps. For additional columns, use horizontal table scrolling with a sticky uncertainty column and headers where feasible. Do not compress all columns to fit.
- Show the selected combination count without quotas or main/wildcard categories. Candidate selection, cell inspection, and analyst approval remain distinct. Optional Explore a disruption adds one candidate per model to the same list; standard generation adds three per model.

### Cell interaction contract

1. Activate a hypothesis cell to select it and update the inspector. Keep focus on the triggering control; provide a keyboard-accessible `Edit hypothesis` action that moves focus into the inspector when requested.
2. Show scenario name, uncertainty, current hypothesis, its provenance, relevant coherence reasoning, contradictions and assumptions. Each model's reasoning is separately inspectable and clearly attributed using its real identifier.
3. The hypothesis selector lists states for that uncertainty only, plus `Unresolved`. The grid and inspector edit the same combination record.
4. On change, save the edit, record its revision and label the affected combination `Analyst-edited`. Preserve earlier coherence notes with their checked revision/time; label them `Review suggested` if they precede the edit.
5. Show which dependent narratives or combinations are affected. Preserve their content and approval history. Do not equate review suggested with proven invalidity.
6. Opening the panel, changing a cell and approving a combination make zero AI calls. There is no separate coherence recheck action. Preserve the model reasoning from generation and any historical checks, with their original revisions and attribution.
7. Allow approval with an intentionally unresolved uncertainty. Keep that uncertainty visible downstream; it cannot be silently filled in by the writer.

A model disagreement is a reason to inspect, not an automatic blocker. Initial generation includes coherence assessment; the reference's generic model text is not that implementation. Production needs the actual reinforcing relationships, tensions, assumptions, timestamps and model provenance.

The footer uses an accurate action such as `Approve 3 selected combinations`, with the count derived from selection. Keep undo separate and available. Revoking approval must not discard a draft produced from the earlier approved revision.

## 5. Extend Common Ground through the workflow

| Screen | Recommended composition | Important behaviour |
| --- | --- | --- |
| Projects | Calm project list with title, question/horizon excerpt, last saved time and current stage | `New exercise`, `Resume`, `Import project`; destructive deletion is explicit; explain that projects live in this browser |
| OpenRouter setup | Short explanatory form with masked key input, a connection test and external setup links | Explain prompts leave the browser through OpenRouter; session-only key storage by default; never put the key in exports or logs |
| Exercise configuration | Question and horizon first; optional drivers below; Quick/Research choice; expandable model and budget settings | Question + horizon are the only required analytical inputs; show estimated operation cost before launch |
| Research checkpoint | Short synthesis, then contested findings, evidence gaps and expandable source rows | Inspect publisher, URL, date, verification status and discovery attribution; exclude/flag sources and explicitly approve the evidence base |
| Explore drivers | Readable table with name, short description, PESTLE tags, origin and review status; selected-driver editor below | Add/edit/merge/split/remove; preserve original proposals behind merges; single-model ideas remain visible |
| Assess drivers | Impact × uncertainty plot beside a prioritised review queue, with a table alternative | Inspect per-model positions, edit final scores numerically, and explicitly approve remaining medians |
| Select uncertainties | Reuse the approved matrix/table with selection controls and a selected-items summary | Recommend 4–6 without enforcing a cap; explain increasing combination complexity; no required causal map |
| Develop hypotheses | One expandable uncertainty section with distinct future-state options and provenance | The number of alternatives varies; support add/edit/merge/split/remove and explicit approval; do not force three states |
| Construct combinations | Scenario columns, uncertainty rows, contextual reasoning/editor below | See the interaction contract above; analyst review and optional disruption exploration |
| Write & review scenarios | One prose workspace with combination guidance, rich-text/Markdown editing, undo/redo, collapsed AI help and an optional review checklist in each editor | Write from approved combinations; compare AI proposals before explicit application; require text for every selected scenario before saving the final set and continuing to export; preserve original/working/final snapshots; QA checkboxes never block completion |
| Completion/export | Scenario list and straightforward export choices, with annotation options | Copy, Markdown, DOCX, PDF, full analytical record and project/analytical JSON; explain the difference between portable project and analytical data |

### Matrix detail

Choose **x = uncertainty** and **y = humanitarian impact**, both 1–5; use these labels consistently. Both are ordinal judgements. Provide the complete score anchors from spec §8.4 next to the controls. Neither axis is probability or generic system influence. This plot supports prioritisation; it is not a 2×2 scenario-building method.

Plot the provisional median separately for each axis. Even-sized model sets can produce fractional medians such as 3.5; preserve them. Do not label a median as the analyst's decision until approved. A selected driver reveals the underlying model marks with names and explanations. If showing a connector or score range, label it as disagreement; it is not a statistical confidence interval.

Make coincident points inspectable without falsifying their coordinates: group identical positions with a count and list, or use labelled offsets while retaining true values. Avoid jitter that appears to be an actual score. The accessible table exposes the same data and supports all score editing and approval actions.

Prioritise disagreements, high impact/high uncertainty and unusual contributions. Expose sorting and explain why a driver is in the queue. Any default disagreement threshold is a configurable usability heuristic, not a scientific threshold. Missing scores remain missing; never turn them into zero or silently claim complete coverage.

### Research and narrative detail

Research Mode includes its evidence checkpoint in the MVP. Make provenance inspectable but keep the default narrative clean. Distinguish present/historical evidence, scenario hypotheses/assumptions and imagined future developments in annotation text as well as appearance. A citation supporting a present fact does not validate a future event. Edited text can detach annotations; show `Review suggested` rather than retaining a misleading link.

Quick Mode displays no fabricated citations. An inaccessible source is `Unverified source` or `Evidence unavailable`, not confirmed support. Follow-up research shows the proposed question, why it matters and estimated cost before an explicit approval action. The completion screen may suggest further analytical work; it does not add consequence-assessment, early-warning, strategy or briefing modules to this app.

## 6. Component and state contracts

These are suggested component boundaries for SvelteKit, not mandatory filenames. Domain changes and AI orchestration live outside presentation components, as specified in `spec.md`.

| Component | Owns visually | Must receive or emit |
| --- | --- | --- |
| WorkbenchShell / StageNavigation | Project context, ordered stages, save/cost access | Stage status and prerequisites; navigate intent; never infer approval from navigation |
| StageActionBar | Decision summary and primary action | Selected count, prerequisites, pending save and operation state; approve/generate intents kept separate |
| ModelAttribution / ModelRunList | Exact identities, contribution coverage, per-model progress | Model IDs, operation statuses, missing cells; retry/replace/skip intents |
| DriverMatrix / AssessmentTable | The same scores in plot and accessible controls | Provisional median, individual ratings, analyst decision, missing values, approval type |
| HypothesisCell / ChainGrid | Selected intersection and hypothesis value | Stable combination, uncertainty and hypothesis IDs; select/edit intents, including explicit unresolved |
| ReasoningPanel | Attributed explanations, tensions and context editor | Current revision, checked revision, model contributions, dependencies; analyst review |
| EvidenceInspector | Source metadata, claim support and verification state | Finding/source IDs and annotation type; exclude/flag/approve intents |
| DependencyNotice | Affected saved work and the upstream change | Parent revision and affected records; inspect/retain/selectively-regenerate intents |
| NarrativeEditor | Working prose, evidence display and manual editing | Selected draft/revision, working document, anchors, save state; edit/undo/finalise intents |
| CostControl | Estimate, confirmed spend, reservations and budget | Separate known/estimated/unknown values; explicit budget or launch decisions |

Store the selected cell by stable IDs, not row/column indices; sorting or filtering must not move the selection to another object. Distinguish selected, edited, approved and needs-review states. A single boolean or a green tick cannot represent all four.

| Situation | Treatment and useful copy |
| --- | --- |
| AI proposal | Neutral label: `AI-proposed`; include attribution |
| Analyst decision | Check + `Analyst-approved`; edited values retain `Analyst-edited` history |
| Upstream change | Amber notice: `Income support changed. Two combinations and one narrative may need review.` Include affected items |
| Empty driver list | `Start by exploring possible drivers.` Primary action: `Generate drivers`, with estimate |
| Operation running | Per-model queued/running/succeeded/failed/cancelled rows; show useful partial results |
| One model fails | `Two models finished. [Model name] did not return a score for Housing access.` Retry only failed work, replace explicitly, or continue partially |
| Budget admission blocked | State the next operation's estimate and remaining allowance. Offer budget/model adjustment or resume later |
| Unsaved edit | Persistent `Changes not saved` near save state, with retry and backup action; no success tick |
| Offline | `You can review and edit saved work. Reconnect to run models.` Preserve offline edits |
| Annotation detached | `Source link needs review after this edit.` Keep the earlier association inspectable |
| Restore snapshot | Explain what will be restored and preserve the current working draft until the user confirms |

Report confirmed spend separately from estimated/reserved/unknown charges, in USD. A budget is an estimate-based admission control, not a guaranteed external spending cap. Cancellation prevents additional queued calls but may not stop or refund calls already sent. No generic percentage bar unless there is a meaningful known denominator.

Do not say `Consensus`, `Validated`, `Safe`, or `Correct` merely because models agree. Prefer `Models gave similar scores`, `Analyst-approved`, and `Coherence checked before your latest edit`.

## 7. Accessibility and input behaviour

- Target WCAG 2.2 AA as required by the spec. Validate contrast, semantics and actual workflows; a pleasant palette alone is not compliance.
- Use landmark regions, a logical heading hierarchy and a skip link. Stage navigation is navigation, not a set of decorative labels.
- Use semantic tables with captions, row/column headers and native controls. Avoid `role="grid"` unless implementing its full keyboard pattern. Default table buttons use normal Tab order and Enter/Space activation.
- Provide a non-drag input path for every matrix change. Every hypothesis, source and model contribution is accessible without hover.
- Show a clear focus indicator in both appearances, including on the dark sidebar. Keep focus visible beneath sticky headers/footers. Maintain focus when a control updates; return it to the trigger on closing a dialog or popover.
- Native select controls are acceptable for hypothesis choices. Long descriptions can be shown in a labelled detail panel rather than truncated option-only text. Richer comboboxes require a complete keyboard and screen-reader implementation.
- Use text and shape alongside colour for model identity, selection, approval and review status. `Unresolved` is explicit text.
- Announce meaningful save, approval, failure and dependency changes through a polite status region; actionable errors can use an alert. Do not announce every streamed token or hover.
- Give icon-only controls accessible names. Explain disabled actions in persistent nearby text rather than an inaccessible tooltip.
- Test at 200% zoom, with reduced motion, with long labels and with keyboard-only input. Verify the critical flow with a screen reader.

## 8. Implementation sequence and scope

Start with the shell, tokens and core controls, then build the combination table and inspector using deterministic fixtures. Verify the approved composition and accessibility at laptop width before multiplying components. Add the matrix/table and driver/hypothesis workflows next, followed by the narrative editor, evidence checkpoint and remaining foundation/export screens. This is an implementation sequence; Research Mode remains required for public MVP release.

The reference is intentionally a small demonstration. It does not implement real navigation, setup, research, matrix scoring, candidate selection, complete coherence reasoning, IndexedDB, model access, dependency tracking, exports or the full editor. Its model names, costs, stage completion markers and analysis are examples. Use the documented contracts above and the functional spec to build those behaviours.

Before calling the handoff implemented, run [design/ACCEPTANCE.md](design/ACCEPTANCE.md), including partial failure, upstream edits, unresolved uncertainties, budget admission, human-first writing and explicit AI proposal application. Remaining decisions to validate through the pilot include information density, the default disagreement threshold, long-grid navigation and the optional narrative typeface. None requires reopening the selected Common Ground direction.
