# Scenario Designer

**Product requirements and implementation specification — v1.0**  
**Status:** Requirements baseline for design and engineering handoff  
**Product owner:** Matthew Gwynfryn Thomas
**Date:** 1 November 2026  
**Initial deployment:** Public open-source web app, hosted on GitHub Pages  
**Primary readers:** Product designer, frontend developer, technical lead, testers

> **Product promise:** Help one humanitarian analyst, working with a diverse ensemble of AI models, create a set of distinct, coherent and rigorously reasoned narrative scenarios that they could not produce alone in the same limited time—through an experience that feels intuitive, joyful, intellectually stimulating and genuinely collaborative.

## 1. Executive summary

### 1.1 The problem

Participatory scenario design benefits from diverse perspectives, challenge and collective imagination, but emerging humanitarian issues often need to be analysed before a workshop can be organised. An analyst working alone may lack the time, capacity or variety of perspectives to explore a broad space of possible futures. Asking an AI model to generate three scenarios in one prompt typically produces superficial, formulaic results.

The product addresses this gap with an **analyst-led, step-by-step, multi-model scenario design workflow**. Models independently explore drivers, score humanitarian impact and uncertainty, generate future hypotheses, propose coherent combinations and help draft narratives. The analyst retains control of decisions at every stage.

The methodology is inspired by the product owner's published reflection, [*Humans and machines, imagining futures together* (2023)](https://medium.com/data-and-insight-hub-at-british-red-cross/humans-and-machines-imagining-futures-together-68767ea8c673), which applied AI assistance to cost-of-living scenarios and described PESTLE exploration, assessment of drivers, future hypotheses and scenario construction. This product intentionally refines that approach, including **humanitarian impact** as the matrix's impact axis, rather than general influence on the analytical question. [1]

### 1.2 Product boundaries

**Input:** An anticipatory analytical question, a time horizon and, optionally, a preliminary list of drivers. The analyst selects Quick or Research Mode, AI models and optional spending budget.

**Output:** A user-selected set of one or more narrative scenarios, alongside a retrievable analytical record and exports.

**Not the product's job:** Conducting humanitarian consequence assessments after scenarios are complete, deriving early-warning indicators, wind-tunnelling strategies, creating briefings or publishing polished decision-maker products. The completion screen may *suggest* these next steps.

**Audience:** Analysts producing working materials for further analysis and facilitated workshops; **not** a primarily decision-maker-facing writing tool.

### 1.3 Definition of success

The primary success condition is **capability augmentation**: an analyst creates a more diverse, original, plausible and causally coherent scenario set than they could working alone in the same time. Supporting conditions are speed, ease of use and the quality of the collaborative experience.

- **Quick Mode:** target 1–2 hours of end-to-end analytical work; **no more than half a working day** as the design goal. This is a usability/performance target, not an unconditional service guarantee.
- **Research Mode:** may take longer; evidential depth is more important than meeting the Quick Mode time target.
- **User experience:** intuitive, enjoyable, intellectually stimulating; the analyst feels ownership, not like a passive AI-output editor.
- **Output quality:** coherent, distinct and humanitarian-relevant scenarios supported by inspectable assumptions and judgements.

## 2. Confirmed product decisions

The following decisions were explicitly made during requirements discovery. Recommendations and unresolved implementation choices appear separately in Sections 13–15.

| Area | Confirmed decision |
|---|---|
| Interaction | Guided workbench; structured controls in the MVP, no conversational AI |
| Human role | Analyst reviews and approves stages and retains final judgement |
| Initial input | Analytical question + time horizon; optional drivers only |
| Modes | Quick: models' existing knowledge; Research: external evidence discovery and review |
| Models | OpenRouter only; user provides API key; recommended diverse ensemble of 3, customisable overall and by stage |
| Perspectives | Independently generated model contributions; show agreement/disagreement and attribution |
| System exploration | PESTLE-informed, not PESTLE-constrained |
| Drivers | Independently generated; deduplicated/consolidated; analyst can add/edit/merge/split/remove |
| Matrix | **Humanitarian impact × uncertainty**, 1–5 scales, median provisional scores; inspect model positions |
| Review | Assess all drivers; prioritise exceptions; analyst may bulk-approve remaining medians |
| Critical uncertainties | Analyst chooses number; recommendation 4–6 but not enforced |
| Hypotheses | Independently generated; consolidated; number proposed by AI for each uncertainty; analyst edits |
| Scenario method | Multiple hypotheses / coherent scenario combinations; not a 2×2 quadrant method |
| Combinations | AI candidate combinations + systematic coherence review; table and detail views |
| Combination completeness | One hypothesis per uncertainty by default; explicit unresolved options permitted |
| Combination review | Analyst reviews edits and reapproves; no separate AI coherence recheck |
| Scenario count | Any selection of one or more combinations; generation offers 3 candidates per model, or 1 through optional disruption exploration |
| Disruption exploration | Optional; one surprising candidate per model, with additional drivers reviewed before approval |
| Writing | Human-written first draft; optional whole-scenario AI editing or generated starting drafts on request |
| Narrative format | Flowing analytical prose, flexible structure, roughly 400–600 words provisionally |
| Revisions | Rich-text and Markdown editing; optional AI proposals require explicit application |
| QA | Advisory checklist only; no required sign-off and no extra AI critique |
| Evidence annotations | Hidden by default, toggleable, including in exports when available |
| Research Mode | Independent discovery → shared evidence base → independent model analysis; prioritised human review; targeted follow-up research with approval |
| Workflow | Revisit stages; track downstream dependencies; preserve edits; selective regeneration offered |
| Persistence | IndexedDB autosave + portable import/export project file; no accounts |
| History | Original human or AI draft, current working draft and final snapshot; ordinary undo/redo |
| Exports | Narratives via copy, Markdown, DOCX, PDF; full analytical report; machine-readable JSON |
| Costs | Prices/estimates, usage reports, optional exercise budget and warnings |
| Failures | Keep partial results; retry, replace or skip model without silently substituting |
| Privacy | Public/non-sensitive analysis only; no confidential operational or personal data |
| Access | Public, open source; desktop-only MVP |
| Technology | SvelteKit + TypeScript, static-first, hosting-independent, GitHub Pages initially |

## 3. Users, needs and use cases

### 3.1 Primary user

A humanitarian analyst or foresight practitioner who has an anticipatory question and some domain knowledge but cannot convene a participatory scenario workshop in the available time. They may have intermediate analytical experience and limited familiarity with API keys.

Their central job-to-be-done: **“When I need to explore how a consequential humanitarian issue might evolve, help me rapidly construct and scrutinise a useful set of alternative futures, drawing on varied machine perspectives without surrendering my judgement.”**

### 3.2 Example use case

An analyst asks: “How might the UK's cost-of-living crisis evolve over the next three years, and what could that mean for people experiencing financial hardship?” They optionally input known drivers (e.g. energy costs or government support), run independent PESTLE-informed discovery, review competing model ratings of humanitarian impact and uncertainty, select critical uncertainties, approve future hypotheses, construct coherent combinations and obtain three editable analytical scenarios for use in subsequent workshops or analysis.

### 3.3 User needs

- Start with minimal preparation and understand the workflow without prior training.
- Encounter perspectives or combinations they would not have developed alone.
- Know **which model said what** and why, particularly where scores conflict.
- Exercise granular control without having to manually manage dozens of model responses.
- Trust that edits and approved decisions will not be silently overwritten.
- Continue from an interrupted session and take work out of the app.
- See likely and actual model costs before spending more credits.
- Distinguish evidentially supported findings from hypothetical future developments.

## 4. Scope, priorities and exclusions

### 4.1 MVP requirements (must ship together)

**Foundation:** onboarding; privacy notice; OpenRouter API key; model selection; mode selection; project list; autosave/import/export; spending control; stage navigation.

**Analytical workflow:** model-independent driver generation; consolidation; model-independent impact and uncertainty scoring; matrix and review-by-exception; critical uncertainty selection; hypothesis generation; combination construction with initial coherence reasoning; scenario drafting; manual editing; advisory QA.

**Research Mode:** independent source discovery, source consolidation, source validation/provenance, prioritised evidence review, user-initiated follow-up research, annotations.

**Handoff:** narrative export (copy/Markdown/DOCX/PDF), full analytical record, versioned machine-readable JSON.

### 4.2 Deliberately excluded from MVP

- Accounts, cloud synchronisation or real-time team collaboration.
- Uploading research papers, horizon scans, briefings or other documents; explicit initial assumption capture.
- Conversational agent/chat within each stage.
- AI-generated critiques of final scenario sets; automated quality scoring.
- AI-assisted revision of *selected* narrative passages. Whole-scenario editing is available on explicit request.
- Full version history, named revision branches, comments and tracked changes.
- Fully responsive/mobile interface; participant-facing workshop facilitation features.
- Dedicated strategy wind-tunnelling, humanitarian consequences, early-warning or briefing modules.
- A required causal systems map or explicit pre-selection relationship analysis.
- A traditional two-axis 2×2 scenario construction mode.
- Automated processing of confidential operational or personal information.

**Roadmap item needing prioritisation:** Optional immersive storytelling output (future newspaper, day-in-the-life, etc.) was desired in principle, but **was not explicitly assigned to the MVP**. Treat as post-MVP until scheduled by the product owner.

## 5. End-to-end journey

The six core analytical stages, plus setup and export, form the primary navigation. Writing, optional review and final approval share one stage. Stage-level results persist as structured objects.

| Step | Analyst activity | AI/system responsibility | Exit / output |
|---|---|---|---|
| 0. Setup | Connect key, select models, mode, budget, question, time horizon, optional drivers | Validate settings, estimate spending, establish exercise | Exercise configuration |
| 1. Explore drivers | Review/add/merge/edit/split/remove consolidated drivers | Independent PESTLE-informed proposals; semantic consolidation | Approved driver list |
| 2. Assess drivers | Examine disagreement, adjust positions, bulk approve | Independent 1–5 impact + uncertainty scores and explanations | Approved impact × uncertainty matrix |
| 3. Select uncertainties | Choose critical drivers (suggested 4–6) | Show candidates/complexity feedback; **no relationship analysis required here** | Approved selection |
| 4. Develop hypotheses | Review distinct futures for each selected driver | Independent generation; consolidation; recommend number per driver | Approved future-state hypotheses |
| 5. Construct combinations | Compare/edit/choose combinations; review edits and approve | Independent candidate construction; evaluate interactions/contradictions | Approved scenario combinations |
| 6. Write & review scenarios | Write and edit narratives from approved combinations; optionally request AI help or use the QA checklist; approve the final set | Autosave drafts; return AI proposals for explicit acceptance; preserve original/working/final snapshots and annotations | Completed scenario set |
| 7. Export/next steps | Download narratives/full record/JSON; consider next uses | Generate requested export; suggest follow-on analytical activities | Portable output |

**Research Mode insertion:** After setup, independent source discovery → consolidation → prioritised review and approval, before driver assessment proceeds. Evidence may inform driver discovery as well. Later stages can propose narrow research questions, but **never launch follow-up research without analyst approval**. Results of follow-up research must identify potentially affected earlier decisions.

### 5.1 Primary happy path

1. From the landing page, select **New exercise** or **Resume**.
2. For a first-time user, view OpenRouter setup guidance; enter API key; test; see privacy warning.
3. Enter question, horizon, mode; choose recommended three-model ensemble and optional budget; start.
4. Accept/rework consolidated PESTLE-informed driver list; approve.
5. Review impact × uncertainty matrix; inspect outliers, human-adjust selected points; bulk-approve remaining provisional medians.
6. Choose critical uncertainties and approve AI-generated alternatives for each.
7. Compare proposed combinations in matrix; inspect coherence explanations; edit and review; select any one or more desired combinations; optionally explore an additional disruption.
8. Write narratives directly; optionally ask AI to edit the whole scenario or generate a starting draft, then review and explicitly apply or dismiss its proposal.
9. Consult optional QA checklist; approve final narratives; export.

### 5.2 Non-happy paths

- One model fails or returns incomplete JSON: retain other results, identify missing model × driver cells, retry/reassign/skip.
- Insufficient credits/budget: stop new requests, preserve work, offer lower-cost models or resume later.
- Browser refresh/offline while editing: restore last persisted state and explain incomplete in-flight calls.
- Changed upstream driver/hypothesis: downstream nodes remain intact but become marked **review suggested** with dependency explanation.
- Import older project: migrate with versioned schema where supported; otherwise fail safely with an actionable message.
- Research source inaccessible or unverifiable: mark source **unverified**; don't treat it as confirmed support for a factual claim.

## 6. Detailed functional requirements and acceptance criteria

Requirements have stable IDs (FR-xx) to support design tickets and test traceability. Acceptance criteria are representative and should be expanded into automated tests.

### 6.1 Project setup and model access

**FR-01 — Create an exercise.** Require a nonempty analytical question and time horizon; allow optional preliminary drivers. **Accept:** an exercise can start with only the two required inputs; optional drivers appear in the review list with `origin=user`.

**FR-02 — Select mode.** Offer **Quick** or **Research** before starting. Quick does not search externally; Research gathers external sources and prompts approval. **Accept:** Quick has no external research calls; Research clearly labels source discovery and review.

**FR-03 — OpenRouter onboarding.** Link to account, credits and API-key documentation; support paste, test and replace key. **Accept:** invalid key/insufficient credit produces a useful error; app never prints the secret in logs or exports.

**FR-04 — Model ensemble.** Provide three recommended models from different developers; permit add/remove/replace, including per-stage overrides. Show identifier, developer, capability and price when available. **Accept:** selected exact identifiers appear in the exercise record and each contribution; a stage can use a different set.

**FR-05 — Local-first projects.** Create, rename, open, delete and autosave multiple scenarios. Export/import portable full project. **Accept:** refresh restores last saved state; exported file imported into a fresh browser restores edits, approvals, sources and provenance (but **not** API keys).

### 6.2 Drivers and matrix

**FR-06 — Independent driver discovery.** Each model sees question, horizon, optional user drivers and PESTLE exploration instructions, but no other model's response. **Accept:** per-model proposals have preserved provenance, and novel single-model drivers are not automatically removed.

**FR-07 — Consolidation.** Suggest merges for semantically duplicated drivers; preserve variants. User can accept, add, edit, merge, split and delete. **Accept:** merged records point to all originating proposals and keep their source model IDs.

**FR-08 — Independent scoring.** Every approved driver is independently scored 1–5 on humanitarian impact and uncertainty, each with a short rationale. **Accept:** invalid/out-of-range/missing scores are flagged, not silently coerced; scale anchors are accessible.

**FR-09 — Matrix visualisation.** Plot provisional coordinates as median impact and median uncertainty separately; show model-disagreement markers, hover/focus detail and individual model coordinates. **Accept:** selecting a point reveals the underlying scores and explanations; colours are not the sole channel conveying distinctions.

**FR-10 — Review by exception.** Prioritise substantial disagreement, high impact/high uncertainty and unique/outlying findings; permit individual overrides and bulk approval of the rest. **Accept:** final score records identify `explicitly_edited` vs `bulk_accepted_median`; no driver silently acquires an approved state.

**FR-11 — Critical uncertainties.** Allow arbitrary user-defined selection count, recommend 4–6, show complexity implications, don't force preselection causal assessment. **Accept:** selection is editable; impact × uncertainty scores remain inspectable after selection.

### 6.3 Hypotheses, combinations and disruption exploration

**FR-12 — Independent hypotheses.** Models independently propose future states for each selected uncertainty; consolidate overlaps, recommend a suitable number per uncertainty; no fixed hypothesis count. **Accept:** analyst can add/edit/split/merge/delete and approve states; alternatives are distinguishable and belong to a specific uncertainty.

**FR-13 — Candidate combinations.** Independent models propose coherent, contrasting combinations; analyse reinforcing and contradictory relationships. **Accept:** each combination references selected hypothesis IDs, defaults to one per uncertainty, and can explicitly mark an uncertainty `unresolved`.

**FR-14 — Combination editing UI.** Provide comparison matrix plus expandable detailed explanation of combination logic and coherence; edit hypotheses in cells. **Accept:** change in either view updates the same combination record without duplicating data.

**FR-15 — Analyst review after edits.** Generation includes initial coherence reasoning. There is no separate coherence recheck feature. Edits preserve earlier reasoning with timestamps and revisions, and require analyst review and renewed approval. **Accept:** editing and approval make zero model calls; historical reasoning and operation records remain readable, while new coherence requests and retries are unavailable.

**FR-16 — Free scenario selection.** Users choose any number of combinations to take into writing, with at least one required. Generate three candidates per selected model per standard run, independently of final selection. Seek diversity and avoid automatic optimistic/base/pessimistic framing. **Accept:** one, two, seven or more valid combinations can be approved without quotas or main/wildcard categories; zero selected combinations cannot proceed.

**FR-17 — Optional disruption exploration.** Explore a disruption generates one independent candidate per selected model. An optional “What if…?” prompt guides the model; when blank, it proposes a surprising but plausible disruption. Candidates use the approved hypotheses and may propose up to two additional drivers. The analyst accepts, edits or removes additional drivers after reviewing plausibility, humanitarian significance and interactions. **Accept:** all candidates join the same selection list; additional drivers remain unscored and must be accepted or removed before their combination can be approved. Legacy `wildcard` origin/type metadata remains readable for compatibility.

### 6.4 Writing, evidence and QA

**FR-18 — Narrative drafts.** Open an empty editor for each approved combination so the analyst writes first. A collapsed AI-help panel offers a selected model for whole-scenario editing or optional generated starting drafts. **Accept:** human drafts and proposals retain their combination revision; generation is optional and never gates editing or completion.

**FR-19 — Narrative content.** Default flowing prose (~400–600 words guidance), covering future state, causal pathway and humanitarian implications. Optional headings, flexible arrangement. **Accept:** draft preserves explicit unresolved uncertainties and does not invent an outcome for them as fact.

**FR-20 — Narrative editor.** Rich-text editor with Markdown mode, undo/redo and autosave. Optional whole-scenario AI editing accepts analyst instructions, defaulting to clarity and flow while preserving voice and meaning. **Accept:** typing never triggers model calls; AI responses are proposals requiring explicit application. Stale proposals remain inspectable but cannot replace newer text or a changed combination. Supported formatting round-trips and combination data remains unchanged.

**FR-21 — Milestone snapshots.** Store an immutable original human or accepted AI draft, mutable working draft, and final approved snapshot. Capture existing human text before the first AI request or first move to review. **Accept:** apply and restore require explicit action, preserve prior text through undo and never overwrite the original. Every selected scenario requires non-empty text for review and completion.

**FR-22 — Evidence annotations.** Narratives appear clean by default; toggle annotations to source findings, hypotheses and assumptions; exports allow inclusion/exclusion. **Accept:** Quick Mode never presents invented source citations; Research annotations distinguish historical fact, supported assumption and speculative future statement.

**FR-23 — Advisory quality review.** Display checklist for coherence, plausibility, distinctiveness, breadth, humanitarian relevance, traceability and clarity; completion never depends on checklist acknowledgement. **Accept:** analyst can complete with all items unchecked; no false “validated” status is displayed.

### 6.5 Research Mode

**FR-24 — Independent evidence discovery.** Models/processes independently search the web with source provenance; user can see which searches/findings came from which model. **Accept:** research prompts and calls cannot inherit earlier models' search results during initial independent discovery.

**FR-25 — Shared evidence synthesis.** Deduplicate and group sources, record agreements/contradictions, coverage gaps and source reliability warnings. **Accept:** sources retain original URL/title/date where available, verification status and links to claims.

**FR-26 — Prioritised evidence checkpoint.** Show concise synthesis, contested/weak findings and gaps; analyst can inspect, exclude or flag sources and approve the resulting evidence base. **Accept:** no subsequent evidence-based judgement is treated as user-approved until this checkpoint is completed.

**FR-27 — Targeted follow-up research.** Later-stage models can flag a narrow information gap, but must request explicit approval for a new external research call. **Accept:** UI states question, expected usefulness and estimated cost; research changes never silently overwrite approved outputs.

### 6.6 Navigation, exports and robustness

**FR-28 — Guided navigation/dependencies.** Show stages with statuses: not started, working, complete, review suggested, blocked. Permit backward and forward movement; preserve dependent objects; offer selective regeneration. **Accept:** changing an approved hypothesis marks affected combinations and narratives for review without deleting human edits or launching AI automatically.

**FR-29 — Exports.** Copy/download narratives (Markdown, DOCX, PDF); full analyst report (at least DOCX/PDF and preferably Markdown); complete machine-readable JSON; portable resumable project JSON. **Accept:** project can reimport; analytical JSON retains stable IDs and provenance; published docs respect evidence toggle.

**FR-30 — Costs.** Estimated cost per operation, cumulative confirmed costs, optional USD budget, warnings near ceiling and admission control for new requests. **Accept:** concurrent requests reserve estimated spend; confirmed cost reconciles after response; app warns that the limit is an estimate not a hard external cap.

**FR-31 — Partial model failure.** Preserve successful responses; retry failed items, replace model with consent or proceed partially. **Accept:** result shows model × operation completeness and identifies missing contributions; no silent model substitutions.

**FR-32 — Privacy.** Clearly prohibit personal/confidential/operationally sensitive data; warn before calls; explain information sent to OpenRouter/model providers. **Accept:** exports, browser logs and error reports exclude API keys; user can delete a local project.

## 7. UX and interaction design brief

### 7.1 Experience principles

1. **Human ownership:** the app invites judgement, never presents AI consensus as truth.
2. **Visible plurality:** disagreement is an analytical resource, not an error to hide.
3. **Progressive disclosure:** a clear default view with inspectable reasoning, provenance and detailed controls.
4. **Joyful intellectual exploration:** make discovery, unusual connections and hypothesis comparison pleasurable; avoid over-animated or game-like frivolity in serious humanitarian contexts.
5. **Low-friction depth:** minimise confirmations that add no substantive analytical value; use deliberate stage checkpoints.
6. **No surprise AI spend:** make paid operations explicit; no implicit rechecks after edits.
7. **Reversibility and trust:** autosave, compare, undo, and keep approved work intact.
8. **Accessible analysis:** matrix usable by keyboard and screen readers as well as mouse.

### 7.2 Required screens and core components

| Screen | Essential content | Primary interactions |
|---|---|---|
| Landing / projects | Product promise, privacy notice, new/resume list, import | New, resume, import, delete |
| First-run OpenRouter setup | Links to account, credits, keys; masked key input; test status | Paste/test/replace; choose session-only credential storage |
| Exercise configuration | Question, horizon, optional drivers, Quick/Research, model ensemble, budget | Select, edit, start |
| Research evidence review | Findings summary, source list, contested findings, gaps, provenance | Exclude/inspect/approve, targeted research later |
| Driver explorer | Consolidated driver table/cards, model provenance, suggested duplicates, PESTLE tags | Add/edit/merge/split/delete/approve |
| Matrix / driver assessment | 1–5 axes, provisional medians, model positions, disagreement indicators, sorted review queue | Inspect, override, bulk approve |
| Critical uncertainty picker | Approved matrix, selected drivers, count and complexity feedback | Select/deselect, proceed |
| Hypothesis workspace | Uncertainty panels with distinct AI-proposed future states and provenance | Add/edit/merge/split/remove/approve |
| Combination workbench | Scenario comparison matrix and detail drawer, AI coherence analysis | Edit cell, compare reasoning, select and approve combinations |
| Narrative workbench | Human-first rich-text/Markdown editor, optional AI-help proposals, combination reference, advisory QA | Write, optionally request/apply edits, finalise |
| Completion & export | Scenario summary, copy/download choices, next-step suggestions | Export, archive, resume editing |
| Global shell | Workflow sidebar, stage status, project name, save state, estimated/actual cost, model settings | Navigate, open controls, export |

### 7.3 Interaction details

- **Desktop baseline (design recommendation):** start with a 1280px-wide layout, then test at 1024px laptop width and 1440px+. Mobile shows a clear unsupported-screen message; this is not a license to make content inaccessible at browser zoom.
- **Matrix:** point plot plus keyboard-accessible table/slider alternative; model points revealed on selection, with explanatory legend and robust focus order. Position may be changed numerically or by drag; both update the same score.
- **Disagreement queue:** allow sorting by impact median, uncertainty median, score range and source uniqueness. Do not use a fixed “disagreement threshold” as if scientifically validated; it is a configurable UX heuristic until tested.
- **Scenario combinations:** grid columns represent scenarios, rows uncertainties, cells hypothesis selectors with deliberate “unresolved” option; expanded view explains causal relationships and critiques.
- **Research:** show a short default synthesis with expandable source cards, confidence/provenance warnings, explicit “approve evidence base” action and no automatic hidden searches.
- **AI operations:** show queued/running/succeeded/failed/cancelled states per model; cancellation should prevent additional calls, although requests already sent may be billable.
- **Microcopy:** distinguish `AI-proposed`, `Analyst-approved`, `Analyst-edited`, `Needs review`, `Evidence unavailable`, `Unverified source`.
- **Empty states:** teach the next action (“Generate drivers”, “Select uncertainties”) rather than leaving a blank dashboard.

### 7.4 Representative design deliverables

Designer to supply a flow map and task flows, desktop high-fidelity screens for setup, driver consolidation, matrix, combination grid, evidence review and narrative editor; component library; keyboard/accessibility specification; loading/partial-error/budget warning states; content/microcopy; clickable prototype suitable for five-user pilot.

## 8. AI methodology and orchestration rules

### 8.1 Independence is a functional requirement

For tasks defined as independent (initial driver generation, initial evidence discovery, impact/uncertainty ratings, hypotheses and candidate combinations), model requests should receive the same approved analyst context **without** other models' outputs. Run independently and in parallel where sensible. Consolidation/synthesis steps explicitly consume the independent outputs **after** they are completed.

Use the selected exact model ID in every call; never silently invoke a different model to replace a failed one. Provider-level routing of an identical model may be acceptable if transparently recorded; model-level substitution requires approval.

### 8.2 Stage orchestration contract

Every operation has:

- `operationId`, `exerciseId`, `stage`, `promptTemplateVersion`, `inputRevision`, `modelId`, `status`, timestamps;
- structured, validated input and response payloads;
- usage totals, estimated vs confirmed USD cost, and optional source references;
- a link to the source artefacts and downstream artefacts created;
- retry lineage and clear human approval state.

Recommended control flow: gather approved context → derive prompt with explicit score definitions and time horizon → estimate/reserve spend → execute selected models independently → parse and schema-validate → preserve raw model response locally for audit where reasonable → consolidate with provenance → present editor/decision UI → commit approved result.

### 8.3 Structured output requirements

Use JSON Schema / typed validators for driver lists, rating tables, hypotheses, combinations, coherence results and source claims; validate locally even when using provider structured-output features. The app must reject, repair with explicit logged retry, or expose malformed outputs—not silently fabricate omitted drivers or fill missing scores with arbitrary values. Provider endpoint support for strict structured output can vary and should be tested. [4]

### 8.4 Humanitarian impact and uncertainty

Both scores are ordinal, **1–5**, not mathematically precise probabilities. Provisional median is calculated **per axis** (for an even number of models it may be x.5; show and retain fractional median for plotting even though each model's score is integer). Never mislabel the median as a human score before approval.

| Score | Humanitarian impact | Uncertainty about future trajectory |
|---|---|---|
| 1 | Negligible consequences | Highly predictable |
| 2 | Limited consequences | Relatively predictable |
| 3 | Substantial consequences for some populations | Several credible trajectories |
| 4 | Serious or widespread consequences | Considerable uncertainty |
| 5 | Severe, potentially systemic consequences | Highly uncertain, radically different plausible outcomes |

**Impact is humanitarian consequence, not system influence or probability of occurrence.** Assess against the analytical question and specified horizon; consider who might be affected holistically, without requiring dimension-by-dimension scoring. The structured impact methodology is a roadmap item.

### 8.5 Hypothesis design rules

Hypotheses are **distinct alternative future states**, plausibly reachable within the specified time horizon. Avoid redundant variants; allow qualitatively different futures, not just better/stable/worse. Trajectories are developed when composing and writing scenarios, rather than mandating lengthy histories for every hypothetical state. Keep future states separate from claims about likelihood.

### 8.6 Combination generation and coherence

Generate multiple candidate combinations without exhaustive Cartesian enumeration. For each combination, capture selected hypothesis for each uncertainty or `unresolved`; causal compatibility assessment, reinforcing interactions, conflicts/assumptions and a short distinctiveness note. Compare combinations with a frozen snapshot of existing candidate choices; seek meaningful diversity without forcing “optimistic/central/pessimistic” labels. Unusual ≠ implausible. Analyst controls selection and may edit; after edits, the analyst reviews and reapproves the combination without a separate model recheck.

### 8.7 Optional disruption exploration

Explore a disruption creates one new candidate per selected model. The optional “What if…?” prompt can describe a disruption; otherwise the model proposes one. Candidates join the same comparison and selection list as every other combination, and any valid selection of one or more can proceed. Up to two additional AI-proposed drivers may be included; each needs analyst acceptance after a brief plausibility/humanitarian significance/interaction assessment, or removal from the combination. If no full impact/uncertainty evaluation took place, do not fabricate a matrix score. Coherence, explicit assumptions and narrative fidelity still apply.

### 8.8 Narrative drafting and QA

The analyst writes first in an empty editor using the approved combination as a reference. A collapsed AI-help panel offers whole-scenario editing with optional instructions and generated starting drafts. Every request is explicit and estimated; every response is a proposal to compare and apply or dismiss. Human drafts and model proposals retain their combination revisions. Narratives are largely flowing prose, with future condition, pathway and humanitarian consequences; 400–600 words is guidance, not a hard cap. Advisory checklist items do not block completion or export.

## 9. Research Mode design

### 9.1 Evidence discovery and validation

Implement independent searches through OpenRouter-supported web tools or equivalent capabilities available **via OpenRouter**. OpenRouter documents `openrouter:web_search` and `openrouter:web_fetch` server tools, but the full product's required citation traceability and browser compatibility should be tested before committing to a particular API integration. [2][3]

Research execution should preserve source records with:

- URL (canonicalised for deduplication), title, publisher/domain, publication date if verifiable;
- retrieval/search timestamps, discovery model, search query where available;
- relevant extracted claims, source support passage/locator where available;
- verification status (`verified`, `partially_verified`, `unverified`, `failed`);
- source-to-finding links, contradiction flags and user exclusion state.

**A model-reported URL is not automatically a verified source.** Attempt retrieval or otherwise check the link and correspondence between source and claimed proposition; be explicit when tools return snippets only or when full-text access fails. Do not manufacture quotes or page numbers.

### 9.2 Shared evidence base

Synthesis merges duplicates but retains source provenance and conflicting findings. User sees a concise summary, key divergences, evidence gaps and possible reliability issues before approving. Approved evidence is shared with models for subsequent independent judgements; sources found in initial independent discovery are not shared until that phase completes.

### 9.3 Targeted additional research

Later steps may flag a bounded query and specify what unsupported assumption it would test. User receives a consent action and cost estimate. Additional evidence attaches to the current approved evidence base with revision metadata. Previously approved driver ratings/hypotheses/combinations are flagged for review when relevant; never silently replaced.

### 9.4 Annotation semantics

Narrative claim-level references distinguish: (1) present/historical evidence-backed fact, (2) scenario hypothesis/assumption, and (3) imagined future development inferred from the combination. A citation to a present-day fact **does not prove** a future event. On human text edits, affected annotation anchors should be revalidated or marked detached/needs review, not misleadingly left in place.

## 10. Data architecture and persistence

### 10.1 Canonical entities

| Entity | Fields / responsibilities |
|---|---|
| `Exercise` | ID, schema version, title, question, horizon, mode, dates, workflow status, budget, selected counts, model ensemble and overrides |
| `Source` / `Finding` | Citation details, claim text, verification status, discovery provenance, exclusion, supporting links |
| `Driver` | ID, title, summary, optional PESTLE tags, original proposals, merges, origin user/AI/wildcard |
| `Assessment` | Driver ID, model ID, numeric 1–5 impact/uncertainty, rationales, operation ID, revision |
| `DriverDecision` | Final impact/uncertainty, explicit vs bulk-approved, editor action, timestamp |
| `CriticalUncertainty` | Link to approved driver, selection status, order |
| `Hypothesis` | ID, uncertainty ID, alternative future state, origins, approval and revision |
| `Chain` / `ChainItem` | ID, scenario type, selected hypothesis per uncertainty or unresolved, coherence notes, selected status |
| `Scenario` / `NarrativeVersion` | Combination revision, title, prose Markdown, working text, original/final snapshots, optional model proposals with input text and instructions |
| `Annotation` | Text anchor, type, linked source/finding/hypothesis/assumption, status |
| `ModelRun` | Stage, selected model, prompt version, status, error/retry, output, token usage, cost |
| `Dependency` | Typed edge from upstream entity/revision to affected downstream entity/revision |

### 10.2 Storage

Use IndexedDB for project data and stage results, including model outputs and research metadata. Use a local application state store to coordinate the UI; flush revisions durably and communicate save status. API keys should **not** live in project data, exports or telemetry. Default: key kept in memory for session use; persistent storage only after an explicit user opt-in with a candid local-device security warning, if implemented.

Portable **project JSON** contains editable state plus provenance (but no key); **analytical JSON** contains structured analytical content for downstream tooling and can omit internal UI transient state. Both include a `schemaVersion` and documented migration behavior.

### 10.3 Example project JSON shape (illustrative, not a final schema)

```json
{
  "schemaVersion": "1.0",
  "exercise": {
    "id": "ex_123",
    "question": "How might the UK cost-of-living crisis evolve?",
    "horizon": { "label": "3 years" },
    "mode": "quick"
  },
  "models": { "default": ["provider-a/model-a", "provider-b/model-b", "provider-c/model-c"], "stageOverrides": {} },
  "drivers": [
    { "id": "drv_energy", "name": "Energy price volatility", "origin": "ai", "approved": true }
  ],
  "assessments": [
    { "driverId": "drv_energy", "modelId": "provider-a/model-a", "impact": 5, "uncertainty": 4, "rationale": "Example only" }
  ],
  "driverDecisions": [
    { "driverId": "drv_energy", "impact": 5, "uncertainty": 4, "approvalType": "explicit" }
  ],
  "hypotheses": [],
  "chains": [],
  "scenarios": [],
  "evidence": { "sources": [], "findings": [] },
  "runs": [],
  "dependencies": []
}
```

The actual schema needs stable revisions, annotations, richer source provenance, model runs and narrative snapshots. Use generated TypeScript types and runtime validation from the same schema where possible.

### 10.4 Dependency and revision policy

Dependency tracking should be explicit but conservative. A changed source can affect findings, model ratings, selected uncertainties, hypotheses, combinations and narratives; a changed hypothesis affects its dependent combinations and narratives. A change **flags** downstream output for review but does not automatically invalidate its truth or overwrite content. Offer the user an explanation and selectively regenerate only after an explicit action. Preserve a record of which parent revision each output was derived from.

## 11. Technical architecture

### 11.1 Baseline stack

- **SvelteKit + TypeScript** for application and interaction layer.
- **Static build** with SvelteKit's static adapter, initially deployed to GitHub Pages via GitHub Actions; design deployment configuration to be portable to alternative hosts.
- **IndexedDB** for persistence and versioned JSON project files.
- **OpenRouter** as the sole initial AI gateway, through a service abstraction capable of per-stage model selection, independent execution, schema validation, retries and budget accounting.
- **SVG-based matrix visualisation** with accessible table controls, and a Svelte-compatible rich-text editor supporting Markdown round-trips.
- **Client-side export pipeline** for Markdown, DOCX and PDF, plus JSON. Confirm performance, pagination, fonts and annotation rendering with a prototype.

Official SvelteKit documentation supports static adapters and explains that a GitHub Pages project path needs correct base-path/fallback handling; confirm the installed SvelteKit version's configuration rather than copying an outdated example. [5]

### 11.2 Proposed module boundaries

```text
src/
  lib/domain/           # drivers, scoring, hypotheses, combinations, scenarios, revisions
  lib/workflows/        # stage transition rules and dependency tracking
  lib/ai/               # OpenRouter transport, orchestration, prompts, parsers
  lib/research/         # source gathering, validation, synthesis, annotations
  lib/storage/          # IndexedDB, project import/export, schema migrations
  lib/export/           # Markdown, DOCX, PDF, analytical/project JSON
  lib/components/       # matrix, tables, cards, combination grid, editor, warnings
  routes/               # app shell and static routes
```

This is a suggested modular split, not a dictated folder tree. The central rule is to keep domain logic and AI orchestration **out of presentation components**.

### 11.3 Essential technical spikes (before full build)

1. **Browser ↔ OpenRouter:** From a real GitHub Pages-style origin, verify CORS/preflight, auth, key handling, model catalogue, structured output, concurrent requests, tool invocation and sensible errors. If impossible, record the architectural trade-off rather than quietly introducing a backend.
2. **Research provenance:** Verify web-search results, URL fetch, citations and claim-to-source verification through the chosen OpenRouter API flow; test multiple model providers and inaccessible sources.
3. **Schema reliability:** Evaluate 3 diverse candidate models for complete structured driver ratings (including 25–40 drivers), hypotheses and combination lists; prove retry/partial-result behavior.
4. **Export and editor:** Verify rich-text ↔ Markdown round trip, portable JSON, DOCX/PDF exports and annotation anchors.
5. **Spending protection:** Test reported usage/cost, concurrency reservations, timeouts and cancellation under user-defined budgets.

### 11.4 API client and configuration

- Get model list/prices from OpenRouter when possible; **do not hard-code current recommendations as permanent truth**. Maintain a small versioned recommended-ensemble configuration that can be updated at release time, and validate availability/capabilities dynamically.
- Each model call declares explicit model ID, structured output schema where supported, prompt version and allowed tools. Only Research Mode may include search/fetch tools.
- Use bounded concurrency, retries with backoff for rate limits, and per-model request status. No silent cross-model fallback.
- Handle the possibility that provider/tool search incurs additional charges independent of final model completion; record uncertain charges as estimates. [6]
- Do not fetch or ship OpenRouter keys in build artifacts or environment variables. A public static app cannot protect the user's bearer token from a compromised browser or hostile third-party script.

## 12. Non-functional requirements

### 12.1 Performance and resilience

- App should remain responsive while multiple calls run; long work must show per-model progress/status, with no frozen interface.
- Quick Mode target is primarily **human active time**, not just model latency. Instrument stage timings without central telemetry by default; pilot participants may explicitly share their measurements.
- Persist decisions before transition between major stages and at regular edit checkpoints; recover after crash/browser refresh.
- Support partial model success and manual retry without erasing successes or double-counting confirmed cost.
- Offline capability is for reviewing/editing *already saved* projects only; AI operations require connectivity.

### 12.2 Security and privacy

- Intended for **non-sensitive and publicly shareable** research only. Warn against names/identifiers of individuals, confidential humanitarian operational details and sensitive security assessments.
- Explain that model prompts and research requests leave the browser and are sent via OpenRouter to selected model providers and, for search, potentially search services.
- Mask key entry; keep key out of project JSON, analytical exports, web analytics, error reports, URL query parameters and console output.
- Use a restrictive content security policy compatible with OpenRouter and essential static assets; avoid unnecessary third-party scripts. Sanitise rich-text/Markdown imports to prevent script injection.
- Storage on a user's device is **not** a guarantee of confidentiality. Deleting a local project should remove its app-managed records, with normal browser-storage caveats.
- Do not add user analytics or third-party trackers by default; aggregate usability insights via an opt-in pilot only.

### 12.3 Accessibility and compatibility

- Design toward WCAG 2.2 AA: semantic headings, keyboard navigation, visible focus, sufficient contrast, accessible dialogs, labelled form inputs, screen-reader text for matrices, table-based alternatives to drag operations.
- Desktop-only MVP, but support normal text zoom/reflow as far as practicable and ensure essential actions remain usable at smaller laptop widths.
- Test current stable Chrome, Firefox, Safari and Edge.

### 12.4 Documentation and open source

- Public repository with README, setup/deployment instructions, design and methodological rationale, limitations of multi-model judgement, license, contribution guide, issue templates and privacy/usage notices.
- No registration or central billing for app use. OpenRouter charges are borne by users who provide keys.
- Licence is **not yet selected**; choose an established OSI-approved licence before public release.

## 13. Cost and spending controls

- Prices shown as indicative, obtained from OpenRouter's model catalogue when possible; actual price can vary by model/provider/usage and tool invocation.
- At launch of each operation, estimate costs from model input/output allowances plus research-tool assumptions. For parallel calls, reserve aggregate estimated spend under the exercise budget before dispatch. Allow warnings and blocking of new jobs when expected budget would be exceeded.
- Reconcile against actual returned usage/cost where provided (OpenRouter documents usage in responses); show unknown costs distinctly. [6]
- Budget is **best-effort app-side admission control**, not a hard cap; already dispatched calls, variable output lengths, provider behavior and third-party tools can exceed an estimate. Recommend a dedicated, spending-limited OpenRouter key as a second protection. [7]
- Never initiate paid AI rechecks merely due to user edits. Confirm expensive batches if they exceed a reasonable configurable warning threshold (product-design heuristic).

## 14. Validation plan and delivery acceptance

### 14.1 Pilot design

Recruit approximately five humanitarian analysts for early qualitative usability testing; expand for comparative evidence. Give analysts similar but not identical anticipatory questions, matched time limits, and compare individual-only scenario development with app-assisted development (counterbalance order where possible). Have reviewers independently judge outputs **without knowing production mode**.

### 14.2 Success measures (provisional, calibrate in pilot)

| Dimension | Measure | Success interpretation |
|---|---|---|
| Augmentation (primary) | Blind ratings of diversity, originality, causal coherence, plausibility, humanitarian usefulness | App-assisted scenario sets outperform solo baseline at equal time |
| Productivity | Active time to the approved, user-selected scenario set; session completion | Most Quick sessions within 1–2 h; half-day maximum target |
| Usability | Task success, observed friction, errors/assistance, qualitative ease-of-use | Analyst can complete without a facilitator or extensive manual |
| Collaboration | Interviews and brief ratings of intellectual stimulation, surprise, agency and enjoyment | Users report discoveries they would not have made alone and feel ownership |
| Trust | Correct interpretation of median vs approved ratings; source provenance and missing model calls | No misleading “consensus”, false sources or hidden replacements |
| Robustness | Partial failure, recovery, import/export, budget warnings | No loss of approved work or unnoticed overspending requests |

Avoid claiming statistical proof from five participants; use the first pilot to locate design flaws and decide on a larger evaluation.

### 14.3 Release acceptance scenarios

1. **Quick happy path:** With a valid key, complete question → drivers → matrix → hypotheses → coherent combinations → three edited narratives → Markdown/DOCX/PDF/JSON exports; reopen exercise after refresh.
2. **Multi-model disagreement:** Mock models return impact 5/4/2; matrix shows median 4, all individual scores, descriptions and an editable human final score; bulk acceptance is labelled.
3. **Partial failure:** One model times out; two remain; analyst retries only failed items or proceeds explicitly with partial coverage.
4. **Research provenance:** Models return overlapping/contradictory sources; shared review surfaces distinction; analyst excludes one; scenario annotation points to remaining source and identifies speculative future claims.
5. **Hypothesis revision:** Editing a hypothesis marks dependent combinations/narratives as review suggested; makes **no paid AI call**; user can selectively regenerate or retain.
6. **Disruption:** Explore a disruption creates an independently selectable candidate with an optional additional driver; acceptance is explicit and no matrix scores are fabricated.
7. **Budget:** An operation that would breach estimated remaining budget is blocked or asks for budget change; running operations preserve known cost data.
8. **Resume/import:** Export a project, clear local browser storage, import file and retrieve approved decisions and working narrative with no API key embedded.
9. **Human-first writing:** Complete narratives without a model key. Typing produces no AI calls; optional model proposals require explicit application, stale proposals cannot overwrite newer text, and original/working/final snapshots remain available.
10. **Access/privacy:** Keyboard-only user can perform critical-uncertainty and score selection; app warns non-sensitive use, never logs key.

## 15. Delivery plan, risks and open implementation decisions

### 15.1 Suggested build sequence

**Phase 0 — Feasibility spikes:** Validate browser OpenRouter, research source verification, schema reliability, editor/exports and cost reporting. Provide written go/no-go results.

**Phase 1 — Core Quick Mode vertical slice:** Exercise setup → driver generation/consolidation → matrix/rating approval → hypotheses → combinations → initial narratives → local autosave/project JSON. Use fixture/mock model responses before live API integration.

**Phase 2 — MVP completeness:** Alternate drafts, disruption exploration, selective dependency tracking, evidence annotations, DOCX/PDF exports, OpenRouter onboarding, budgets, failure handling, quality checklist, accessibility.

**Phase 3 — Research Mode and public launch:** Independent search, evidence review and source validation, targeted research, annotations, regression tests, documentation, usability pilot and release hardening. Research Mode is a **required MVP capability** for public launch; phasing here is implementation order, not removal from MVP scope.

### 15.2 Principal risks and mitigations

| Risk | Impact | Initial mitigation |
|---|---|---|
| Direct browser access to OpenRouter inadequate or insecure | Static deployment or key safety compromised | Early proof of concept; explicit user-security trade-off; revisit minimal user-run proxy only by approved scope change |
| Research “citations” are fabricated or source mismatch | Misleading analytical confidence | Verification status, fetch/claim checks, source exclusion, no invented citation |
| Models share biases despite different developers | Illusory diversity | Preserve disagreements and unique contributions; make no statistical independence claim; independent testing |
| Combination combinatorics or slow LLM responses | Time targets missed | Heuristic candidate sampling; bounded concurrency; targeted attention; cost previews |
| Excessive UI complexity | User experience loses joy and speed | Progressive disclosure, short default screens, pilot testing |
| Silent regeneration or misplaced annotations | Loss of analyst trust | Immutable revisions, dependency flags, explicit paid actions, annotation invalidation |
| Browser data wiped or quota exceeded | Lost work | Automatic persistence, visible save state, portable backup, clear warnings |
| Costs exceed estimates | Unexpected user spending | Concurrency reservations, alerts, per-key OpenRouter spending cap guidance |
| PDF/Word rendering in browser inconsistent | Broken handoff | Export tech spike and golden-file comparison tests |

### 15.3 Implementation decisions remaining (not new product requirements)

1. Decide final recommended three-model ensemble at launch based on availability, quality, independence-in-practice and costs; do not hard-code vendor names in the PRD.
2. Choose the API flow and reliable browser integration for OpenRouter web search/fetch, structured responses and cost accounting after proof of concept.
3. Pick editor and export libraries based on demonstration of annotation-safe Markdown round trips and printable DOCX/PDF layout.
4. Define visual thresholds for “substantial disagreement” and default warnings through usability tests—not as scientific fact.
5. Set a default max concurrency and output-token guardrails based on the selected models and budget performance.
6. Decide whether persistent API-key storage is offered at all. Session-only key storage is safest as the MVP default.
7. Finalise open-source licence, repository name, public URL and contribution policy.
8. Confirm creative storytelling is on the post-MVP roadmap unless explicitly reprioritised.

## 16. Future roadmap

**Near-term (post-MVP):** Contextual chat for exploring and interrogating stages; AI-assisted selected-passage narrative revisions; optional creative storytelling formats; richer analyst-defined initial assumptions and file uploads (research papers, horizon scans, briefings); fuller revision history.

**Expanded methodology:** Structured/multidimensional humanitarian impact scoring (scale, severity, duration, distributional effects), configurable assessment criteria, optional causal systems maps and relationship checking, independent AI critique of scenario sets, possible traditional 2×2 mode.

**Platform and collaboration:** User accounts, secure cloud storage and cross-device sync, multi-user collaboration, responsive tablet/mobile support, organisational governance and potential stronger data-handling controls for sensitive work (subject to substantial design, security and legal review).

**Downstream ecosystem integrations (not part of this app's current responsibility):** Humanitarian consequences analysis, early-warning indicators, wind-tunnelling, anticipatory briefing generation, workshop facilitation and optional exchange with other Humaniverse tools using the structured JSON format.

## 17. Methodological and technical references

[1] Matthew Gwynfryn Thomas (2023), *Humans and machines, imagining futures together*, Data & Insight Hub at British Red Cross. https://medium.com/data-and-insight-hub-at-british-red-cross/humans-and-machines-imagining-futures-together-68767ea8c673  
[2] OpenRouter, *Web search server tool*. https://openrouter.ai/tool/web-search/  
[3] OpenRouter, *Web fetch server tool*. https://openrouter.ai/tool/web-fetch/  
[4] OpenRouter, *Structured output / model endpoint considerations* (discussion). https://openrouter.ai/blog/insights/confidence-thresholds-for-model-escalation-routing/  
[5] SvelteKit, *Adapters* and static deployment documentation. https://svelte.dev/docs/kit/adapters  
[6] OpenRouter, *Support — usage, pricing, API and privacy*. https://openrouter.ai/support  
[7] OpenRouter, *API key creation and spending limits*. https://openrouter.ai/docs/api/api-reference/api-keys/create-keys

*References were checked on 1 November 2026. These document API capabilities, not proof that the proposed browser-only implementation works end to end. The proof-of-concept spikes above remain mandatory.*
