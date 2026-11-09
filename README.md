# Scenario Designer

A local-first, analyst-led workbench for constructing humanitarian scenarios with independent model perspectives. Built from [the product specification](spec.md), [Common Ground](DESIGN.md) and its supplied design tokens.

Individual models use their existing knowledge without external research. Optional **OpenRouter Fusion** combines a model panel and may research the web. The app does not provide a separate Research Mode or evidence-review workflow.

## Run locally

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Choose **Explore an example** to try the complete workflow without a key. The example is authored illustrative material, visibly labelled throughout; its scores and narratives are not model outputs.

The home screen and every workflow page offer a short **Page walkthrough** explaining the main controls and what to do before continuing. Each tour opens automatically once in this browser, across all exercises. Choose **Don’t show walkthroughs automatically** to turn automatic tours off everywhere; the top-bar **Page walkthrough** button always reopens the current tour. Uncheck the option during a replay to restore automatic tours for pages you have not seen. Blocked stages explain their prerequisite when replayed and wait until they are available before opening automatically. These choices stay on this device and are separate from project backups. If preferences cannot be saved, the tour explains that your choices will last until reload. Tours never run models or change your analysis.

To work on your own question, create an exercise and finish **Define analysis**. Choose **Continue manually** to go straight to exploring drivers: the whole workflow, including scoring, hypotheses, chains, writing and export, works without an OpenRouter account, model selection or budget. You can also choose **Continue manually** at any step of the **Models and budget** wizard, including after reopening a partly completed setup. AI help can be added later through **Models and budget** in the top bar.

For optional AI help, the separate **Models and budget** stage walks you through checking an [OpenRouter key](https://openrouter.ai/settings/keys), choosing models and setting a USD exercise budget. A collapsible first-time guide explains accounts, keys and credits, with links to OpenRouter’s documentation. The wizard explains models, tokens, thinking effort and pay-as-you-go costs in plain English. The starting budget is $5; setting it does not buy credits or charge your account. You can reopen the settings modal at any time with **Models and budget** in the top bar, including its Models, Connection and Budget tabs. Existing exercises retain their choices and current stage.

New exercises start with Claude Sonnet Latest, Mistral Large 4 and MoonshotAI: Kimi Latest. Suggested, Free and Browse all lists use the live text-model catalogue, filtered for the connected account when a key is present. Supported thinking effort defaults to High. Whole-exercise models are the main setup path. Optional advanced settings show each AI-assisted stage’s effective models and let you explicitly choose a custom selection or return to exercise defaults. Writing uses one model per proposal, including its saved stage choice. Free models still need a key, but do not require paid allowance. Credits and model requests are billed by OpenRouter. Keys remain in memory only and must be re-entered after a page reload. The wizard saves its position but checks your session key again before restoring a later step.

## Workflow

1. Frame an analytical question and horizon; optionally add preliminary drivers.
   Choose **Continue manually** or complete the optional **Models and budget** wizard before exploring drivers. AI help is optional at every stage.
2. Add drivers yourself or generate them independently with AI. Exact-title duplicates are grouped with attribution; request semantic merge suggestions for duplicates and redundant broader/narrower drivers, or add, edit, merge, split and remove drivers yourself. Proposed semantic merges require acceptance and preserve meaningful distinctions for the exercise.
3. Enter and approve your own humanitarian-impact and uncertainty scores, or generate independent AI scores. Inspect all model positions, adjust scores numerically, or explicitly accept the remaining per-axis medians. Missing ratings remain missing; even-sized medians retain fractional values.
4. Select critical uncertainties. At least one is required; four to six is a useful guide. Selected drivers remain visible as removable chips.
5. Develop hypotheses one uncertainty at a time. The coverage summary names missing uncertainties; the review queue shows counts and approval status. Add alternatives yourself or generate for one uncertainty or the whole set. Organise hypotheses to merge, split or remove them, then approve each uncertainty or approve all retained hypotheses and continue to chains.
6. Generate three candidate chains per model, add your own, or optionally Explore a disruption to create one surprising candidate per model. Choose any number of chains to take into writing, with at least one required. The optional disruption prompt can describe a particular “What if…?”; left blank, the model proposes one. Additional drivers require review and acceptance or removal, and remain unscored. Generation starts with one model selected; add more perspectives in the cost confirmation. Compare candidates, edit their explanations, remove or restore chains, then approve your selection and start writing. Unresolved choices remain explicit.
7. Write and review scenarios together. Draft each story from its approved chain in the rich-text/Markdown editor, use the optional checklist in the same editor, then save the final set and continue straight to export. Optional AI edits and starting drafts remain proposals to apply or dismiss explicitly; original/working/final snapshots and undo/redo preserve your writing.
8. Copy or export Markdown, Word, PDF, full analytical reports, analytical JSON and resumable project JSON.

Writing and final review share one navigation stage. A draft for every selected scenario is required to save the final set; checklist boxes are optional. Earlier saved exercises reopen in the combined workspace with their drafts, snapshots, decisions and model history preserved.

Approvals and generation are separate actions. Editing never runs models. Upstream changes flag downstream work without deleting it. General exercise undo/redo covers local decisions; it resets at model-operation boundaries and never reverses recorded spending. Narrative editing has its own text history.

Each stage explains its completion requirements and offers a direct next action. Missing scores and narratives have named review links; chain approval explains empty selections and invalid references before submission. Driver and hypothesis checkboxes appear only in organisation mode, while uncertainty and chain checkboxes explicitly choose the scenario set. Approval actions can continue directly to the next stage. Export shows the current draft/final state and the contents of the selected download options.

The chain workspace shows the candidate count, visible comparison range and selected count. Its chooser lists all active chains together and saves inclusion changes immediately. There are no main/wildcard categories or final selection targets. Explanations start from the original model contribution and autosave; an intentionally empty explanation stays empty. Selection and analytical changes require renewed approval before final narrative snapshots can be saved. Removed chains retain their writing, notes and snapshots in project backups, and restore unselected for review. They are omitted from active writing, model requests and report exports. There is no separate coherence recheck action. Earlier model reasoning and historical operation records remain available, and edits require analyst review and approval. Legacy target/type fields are preserved in version 1.0 backups but never restrict selection.

Stages with creation actions share one action bar below their guidance: Generate (sparkles), Suggest merges where applicable (merge), then manual entry (plus). The bar stays below the header while scrolling. Search, view and scope controls appear to its right. Hypothesis generation can target all uncertainties, the current one or those missing hypotheses; manual additions let you choose the uncertainty before saving. Writing has the same page-level Generate draft and manual writing actions. Scenario cards open their stories directly; with multiple scenarios, the action buttons ask which named story to use. A single scenario opens directly, without a separate selector.

Merge reviews show the proposed combined record alongside its sources, with an explicit account of which record will be updated and which others will leave the active list on acceptance. Accepted and dismissed decisions remain visible, including after reload. Driver assessments show an inline result summary with returned driver/model counts, missing coverage and outstanding approvals; expand it to inspect current AI medians and open a driver's assessment. Partial results remain available, and neither operation approves records automatically.

## Storage and privacy

- Projects autosave to IndexedDB in this browser. “Saved on this device” appears only after the write transaction completes.
- Download **project backups** regularly. Browser storage may be cleared or evicted. Importing a backup creates a separate exercise.
- Version `1.0` backups are validated, including analytical references. Unsupported versions fail safely; no older-version migration is currently needed.
- The production service worker caches the application shell for offline review/editing after a successful first load. It never caches OpenRouter responses or keys. AI operations need connectivity.
- Use only public, non-sensitive information. Prompts leave the browser through OpenRouter and the selected providers. Do not enter personal data, confidential operations or sensitive security assessments. Local storage is not confidential storage.
- No accounts, analytics, trackers, cloud project storage, environment credentials or third-party scripts are used. Fonts and application dependencies are bundled locally.

## AI and spending behaviour

Individual-model requests use OpenRouter’s [Chat Completions API](https://openrouter.ai/docs/api/reference/overview); each receives the same analyst context without the other models’ responses, model-level fallback, tools or searches. [Fusion](https://openrouter.ai/docs/guides/routing/routers/fusion-router) uses the Responses API with required panel consultation, its Quality panel, web tools and High panel reasoning. It produces one combined contribution rather than separate panel scores. Requested aliases and resolved model IDs are recorded separately. Responses are validated locally with Zod; malformed responses remain inspectable and require explicit retry.

Two workers process requests concurrently. Driver assessments use batches of at most ten drivers per model, with the same batches supplied independently to each model. Generate chains requests three candidates per selected model; Explore a disruption requests one per model. Existing candidate choices are frozen as contrast context for the whole operation, so partial results do not invalidate other contributions. Individual calls have a 180-second timeout; Fusion has a ten-minute timeout and supports cancellation. Most tasks reserve room for 6,000 final-output tokens; chain batches reserve 12,000–20,000. Reasoning effort increases the total output allowance using OpenRouter’s effort fractions, capped by the provider limit and 64,000 tokens. An explicit retry of a truncated chain batch increases its allowance, up to the model limit or 64,000 tokens. The launch dialog shows the actual output allowance, total request count and estimate from the same plan used for dispatch. Fusion has variable pricing, so each operation instead requires a planning allowance (initially $1 or the remaining exercise allowance, whichever is smaller), divided across its batches. This is reserved against the exercise budget and reconciled with actual reported charges; it is never presented as a guaranteed maximum price. Estimates use live catalogue prices and conservative input allowances; the complete operation is reserved before dispatch. Returned usage costs are reconciled separately from reserved estimates and unknown charges. Unknown charges retain their allowance conservatively until the user adjusts the budget. This is app-side admission control, **not a hard external spending cap**. A dedicated spending-limited OpenRouter key is recommended.

Partial successes remain visible as batches finish. All structured tasks use their corresponding strict JSON Schema output when the catalogue advertises support, with requests requiring compatible provider endpoints. Chain schemas constrain the batch count and kind, item count and approved driver/hypothesis pairs; every disruption candidate must also include every selected uncertainty or explicit null. JSON mode or prompt-only output is used for other models according to their advertised capabilities. Local validation always applies because schema enforcement varies by provider. Operation records retain raw responses, completion reasons, usage and costs, and distinguish output-limit truncation from JSON syntax and validation failures. Chain reference errors identify the affected chain and missing, duplicate or invalid entries. Retry targets a failed contribution; ratings retries request only missing cells within that batch for the selected model, and chain retries repeat only the failed batch. Older unbatched chain runs retain their saved scope and are split into bounded retry batches. Replacement models are selected explicitly in the launch dialog, which recalculates their work and estimate. No automatic repair or retry calls are made. Cancellation stops queued calls and aborts local requests, but dispatched requests may still be billed. Reloaded in-flight operations become interrupted failures with truthful unknown-charge records.

The top-bar **Model activity** control shows running and queued request counts across the current exercise. Click it for status details, unread results, errors, cancellation and links to full operation records. **Clear history** hides finished popup entries on this device, including after reload; it preserves the underlying records, model contributions and spending totals. Status animations respect reduced-motion preferences.

Recommended model IDs are a small release-time configuration in `src/lib/domain/project.ts`, verified against the live catalogue before paid execution. Update this configuration as availability and capabilities change. Per-stage overrides are supported. Semantic consolidation is a separate, explicit synthesis operation over collected contributions.

In the launch dialog, chain generation and disruption exploration start with only the first configured model selected. Select additional contributors when useful, or uncheck contributors you want to skip for that run. Select at least one model; the request count, estimate and Run button update to reflect the selection. Whole-exercise and per-stage model settings remain available for subsequent runs.

## Build and deploy

```sh
npm run check
npm test
npm run build
npm run preview
```

The static output is in `build/`. For a host subdirectory:

```sh
BASE_PATH=/scenarios npm run build
```

The included GitHub Actions workflow checks, tests, builds and deploys pushes to `main` using GitHub Pages. In repository **Settings → Pages**, select **GitHub Actions** as the source. The workflow defaults to `/<repository-name>`; use an empty `BASE_PATH` for a root user/organisation site or a custom domain served at its root. No API key is required at build time. The [SvelteKit static-adapter documentation](https://svelte.dev/docs/kit/adapter-static) describes the hosting model and base-path considerations.

## Code map

| Location                | Responsibility                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `src/lib/domain/`       | Versioned schema, judgements, revisions, dependencies, consolidation and authored example |
| `src/lib/ai/`           | OpenRouter transport, prompts, structured validation, orchestration and cost admission    |
| `src/lib/storage/`      | IndexedDB transactions, preferences and interrupted-run recovery                          |
| `src/lib/components/`   | Analytical workspaces, inspector, editor and accessible dialogs                           |
| `src/lib/export/`       | Portable/analytical JSON, Markdown, DOCX and paginated PDF                                |
| `src/service-worker.ts` | Production shell caching, excluding model traffic                                         |
| `design/tokens.css`     | Supplied Common Ground visual tokens                                                      |

The interface uses self-hosted Nunito Sans. The font's OFL licence is in `src/lib/assets/OFL.txt`; the static PDF font is derived from its bundled variable source. The rich-text schema supports headings, paragraphs, bold, italic, lists, quotes and code; arbitrary HTML is not rendered into the application.

## Verification and remaining release checks

See [verification notes](VERIFICATION.md) for automated tests, browser exercises, export checks and explicit limits. Live paid inference, provider-specific output reliability, a complete four-browser/screen-reader audit and the five-analyst pilot still require validation before public release. These are not implied by the authored example or the mocked tests.

The existing repository licence is retained. See [LICENSE](LICENSE) and [CONTRIBUTING.md](CONTRIBUTING.md).
