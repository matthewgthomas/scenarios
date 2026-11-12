# Scenario Designer roadmap

Last reviewed: 11 November 2026.

## What is already available

The app supports the complete manual scenario-design workflow, with optional AI help: drivers of change, impact and uncertainty assessment, critical uncertainties, hypotheses, coherent combinations, disruption exploration, writing and review. It also includes multi-model contributions, semantic merge suggestions, per-stage model settings, human-first editing, local autosave, portable backups, exports, cost controls, partial-failure recovery and page walkthroughs.

Individual AI models use their existing knowledge. OpenRouter Fusion can use web research, but this does not provide the Research Mode, approved evidence base or source verification described in the spec. Current export annotations describe combination hypotheses and assumptions; they are not claim-level evidence citations.

### Delivery principles

AI remains optional and human analyst judgement remains central. New capabilities will preserve explicit approval, visible provenance, existing projects, accessible controls, portable exports and clear costs.

## Improve UX for choosing different models to use for each stage of the analysis

- Minimise the amount of clicks needed to assign different AI models (and/or Fusion router) to different stage.

## Research Mode and an approved evidence base

Partially implemented: OpenRouter's Model Fusion includes web search / deep research.

- Offer a choice between existing-knowledge analysis and Research Mode during setup.
- Run independent source discovery, retaining each model's searches and findings before sharing results.
- Store sources and findings with URLs, titles, publishers, dates where verifiable, retrieval timestamps, discovery attribution and supporting passages or locators when available.
- Check that sources are accessible and support the associated claims. Clearly distinguish verified, partially verified, unverified and failed sources.
- Consolidate duplicate sources while retaining contradictory findings, coverage gaps, reliability warnings and provenance.
- Provide an evidence-review checkpoint where analysts can inspect, exclude or flag sources and approve the shared evidence base before subsequent analysis uses it.
- Allow narrow follow-up research at later stages, with an explicit question, usefulness explanation, cost estimate and analyst approval. Flag affected decisions for review without replacing them.
- Validate browser-based search/fetch integration, structured research outputs and tool-cost accounting before choosing the final implementation.

## Claim-level annotations and evidence-aware exports

Partially implemented for scenario combinations.

- Link narrative claims to sources, findings, hypotheses and explicit assumptions.
- Distinguish historical or present-day evidence, supported assumptions and imagined future developments.
- Keep annotations hidden by default and make them available in the editor and optional exports.
- Revalidate annotation anchors after edits, or mark them detached and needing review.
- Extend project backups, analytical JSON and Markdown/Word/PDF reports to preserve research records, claim links and verification status.

## More precise review and planning controls

Partially implemented.

- Show the combination count and practical complexity of the selected uncertainties and hypotheses before combination construction.
- Extend the existing stage review flags and scoped generation controls with more precise dependencies between individual records and revisions, including future source/finding revisions.
- Explain which downstream decisions are affected by a change and offer regeneration of the affected work on request, preserving analyst edits and unaffected results.
- Calibrate disagreement and attention cues through usability testing, with configurable heuristics where useful.

## Construct scenarios with a 2 × 2 matrix

Let analysts choose two critical uncertainties, define contrasting ends for each axis and develop four quadrant scenarios. Carry the chosen assumptions through writing, review, provenance and exports. Retain the existing multiple-scenario combination method as an alternative. This is a scenario-construction method, separate from the current impact × uncertainty assessment plot.

## Refresh suggested models from AA Briefcase rankings

Automatically update the suggested AI model list using [Artificial Analysis AA Briefcase rankings](https://artificialanalysis.ai/evaluations/aa-briefcase), matched to available OpenRouter model identifiers and capabilities. Show the ranking source and refresh date, consider developer diversity and cost, and preserve users' existing model choices.

The ranking page currently states that there is no publicly available API. Confirm a permitted, reliable data feed or scheduled import before implementing automatic refreshes. Keep a last-known-good list if updates fail, and make clear that benchmark performance is not a direct measure of foresight quality.

## Add fast models to the model picker

Add a tab listing models based on their output speed and/or time to first token.

## Let users choose their OpenRouter Fusion panel

At the moment, Scenario Designer defaults to the 'Quality' panel of models when using [Fusion](https://openrouter.ai/fusion/). Let users choose their own panel.

## Estimate environmental impact of designing your scenarios with AI assistance

- If possible. Not sure whether OpenRouter supports this, or whether environmental impacts could readily be estimated in other ways.

## YOLO mode: Let users run the full scenario design process without any human intervention

Not recommended, but a user might want to fully automate the entire scenario design process. This would essentially turn Scenario Designer into a strategic foresight 'harness'.

## Connect to local AI models

Let analysts call locally hosted models through tools such as Ollama or LM Studio. Add endpoint and model selection, connection checks, capability checks, structured-response validation and clear local-versus-remote attribution. Verify browser access, local-network permissions, CORS and deployment content-security policy constraints. Explain hardware requirements and distinguish local usage from OpenRouter charges; do not silently fall back to a remote service.

## Contextual chat

Add optional conversations for exploring and interrogating the current stage, with the relevant analytical context. Keep chat proposals separate from approved work and require explicit application of analytical changes.

## AI editing of selected passages

Allow analysts to request revisions to a selected narrative passage, compare the proposal and explicitly apply it. Preserve surrounding text, undo history, combination meaning and future evidence annotations. Whole-scenario AI editing is already available.

## Immersive storytelling formats

Offer optional future newspapers, day-in-the-life accounts and other creative presentations derived from approved scenarios. Retain the analytical narrative and clearly label imagined future material.

## Richer starting context and document uploads

Allow analysts to record initial assumptions explicitly and supply research papers, horizon scans, briefings and other documents. Preserve document provenance, distinguish supplied material from verified evidence and integrate with the evidence-review workflow.

## Fuller revision history

Extend existing originals, working drafts, final snapshots and undo/redo with a browsable history, named revision branches, comparisons, comments and tracked changes.

## Expanded foresight methodology

- **Multidimensional humanitarian impact:** assess scale, severity, duration and distributional effects, with an inspectable way to combine or compare judgements.
- **Configurable assessment criteria:** let analysts adapt criteria and scales to their use case while retaining definitions and provenance.
- **Optional causal systems maps:** explore relationships, reinforcing effects and contradictions without making mapping a prerequisite for scenario design.
- **Independent AI critique:** offer optional critique of complete scenario sets and, subject to methodological validation, advisory quality measures. Preserve human judgement and avoid presenting scores as proof of validity.

## Platform and collaboration

- Optional accounts, secure cloud project storage, cross-device synchronisation and recovery, alongside the existing local-first workflow.
- Multi-user collaboration, shared reviews and participant-facing workshop support.
- A fully responsive tablet/mobile workflow, beyond the current desktop-first interface and reflow work.
- Organisational governance, permissions and stronger data-handling controls. Any future support for sensitive work requires substantial security, privacy and legal review; current use remains limited to publicly shareable, non-sensitive material.

## Downstream ecosystem and integrations

Explore handoffs or integrations for humanitarian consequences analysis, early-warning indicators, strategy wind-tunnelling, anticipatory briefings and workshop facilitation. Use structured JSON exchange for potential connections with other Humaniverse tools. These are candidates for collaboration or separate tools, rather than committed modules in Scenario Designer.

## Request resilience and spending refinements

Partially implemented.

- Add configurable warnings for unusually costly operations and approaching the exercise budget ceiling, alongside existing cost previews and admission control.
- Improve rate-limit recovery with bounded backoff for explicitly requested retries, retaining partial results, cancellation and accurate spending records.
- Extend reservations and reconciliation to research-tool charges and uncertain costs.

## Validation before claiming the spec's full release criteria

Outstanding validation, rather than missing core workflow features.

- Validate live multi-provider requests, structured-output reliability, costs, failure recovery and browser access from the deployed static origin.
- Complete accessibility and screen-reader audits and test the full workflow in Chrome, Firefox, Safari and Edge, including keyboard operation, zoom/reflow and exported documents.
- Run an initial pilot with approximately five humanitarian analysts; compare scenario quality and active working time with solo practice, and assess agency, enjoyment and trust.
- Add local stage-timing measurements to support the pilot without central telemetry by default. Treat the 1–2 hour working-session goal as a target to evaluate.
- Resolve issues found in the pilot and publish the limits of the validation evidence.

## Multilingual scenario design

- Present the Scenario Design app in multiple languages.
- Let users choose what language(s) they'd like the AI models to respond in.
