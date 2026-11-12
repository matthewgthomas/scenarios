# Scenario Designer

At its best, foresight brings together [diverse voices and perspectives](https://www.forumforthefuture.org/what-does-it-mean-to-decolonize-the-future) to imagine ‘what if’.

So what if we included artificial intelligence (AI) alongside these voices?

Scenario Designer uses an AI-augmented version of [IARAN’s approach to strategic foresight](https://www.iaran.org/strategic-planning) to design scenarios. It will guide you through:

- Identifying the drivers of change in the system you’re analysing.</li>
- Judging the impact and uncertainty of the drivers of change.</li>
- Coming up with hypotheses for how drivers of change might evolve in future.</li>
- Connecting these hypotheses into coherent, contrasting 'combinations'.</li>
- Writing scenarios from your selection of hypotheses.</li>

At every stage, you can choose to receive inputs from a diversity of AI-generated views. Using AI is completely optional. You can complete the entire scenario design process without AI assistance if you wish.

Human expertise and judgement is vital. We must always check for confidently delivered nonsense (from machines as well as humans). But AI models <em>can</em> be helpful for checking our own biases, particularly if we are working as individual analysts exploring potential futures.

And remember that AI reflects the biases and worldviews of the data that goes into training them — which generally excludes the most marginalised and minoritised people — so proceed with caution if bringing AI into your foresight practice.

## This repo

In this repo, you'll find the source code for Scenario Designer, [the product specification](spec.md), the ['Common Ground' design system](DESIGN.md) and the [product roadmap](ROADMAP.md).

## Run locally

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Choose **Explore an example** to try the complete workflow without a key. The example is authored illustrative material, visibly labelled throughout; its scores and narratives are not model outputs.

The home screen offers a short, three-step orientation once in this browser. Later stages use contextual guidance; detailed **Page walkthroughs** remain available on demand from the top bar. Replay and automatic-orientation preferences stay on this device, separately from project backups. Tours never run models or change your analysis.

**Explore an example** starts at its analytical question and offers a seven-step guide tracing household energy through scoring, uncertainty selection, contrasting hypotheses, a scenario combination and its narrative. **Exit example** sits beside the guide’s primary action and returns to your scenarios. Upstream approvals and all example material are explicitly labelled as authored illustrations. Browsing the guide does not save a copy; editing does.

To work on your own question, create an exercise and finish **Define analysis**. Choose **Continue manually** to mark AI setup **Skipped** and go straight to exploring drivers: the whole workflow, including scoring, hypotheses, combinations, writing and export, works without an OpenRouter account, model selection or budget. You can also choose **Continue manually** at any step of the **Models and budget** wizard, including after reopening a partly completed setup. AI help can be added later through **Models and budget** in the top bar.

For optional AI help, the separate **Models and budget** stage walks you through checking an [OpenRouter key](https://openrouter.ai/settings/keys), choosing models and setting a USD exercise budget. A collapsible first-time guide explains accounts, keys and credits, with links to OpenRouter’s documentation. The wizard explains models, tokens, thinking effort and pay-as-you-go costs in plain English. The starting budget is $5; setting it does not buy credits or charge your account. You can reopen the settings modal at any time with **Models and budget** in the top bar, including its Models, Connection and Budget tabs. Existing scenarios retain their choices and current stage.

New scenarios start with one recommended model, Claude Sonnet Latest. Suggested, Free and Browse all lists use the live text-model catalogue, filtered for the connected account when a key is present. New scenarios request Medium thinking effort where supported; existing scenarios keep their saved preferences. Whole-exercise models are the main setup path. Optional advanced settings show each AI-assisted stage’s effective models and let you explicitly choose a custom selection or return to exercise defaults. Writing uses one model per proposal, including its saved stage choice. Free models still need a key, but do not require paid allowance. Credits and model requests are billed by OpenRouter. Keys remain in memory only and must be re-entered after a page reload. Model selection, thinking effort, token prices and Fusion sit behind advanced controls. Setup shows a live allowance estimate for generating drivers, and the launch dialog puts sent information and web research status above configuration. The wizard saves its position but checks your session key again before restoring a later step.

## Workflow

1. Frame an analytical question and horizon; optionally add preliminary drivers.
   Choose **Continue manually** or complete the optional **Models and budget** wizard before exploring drivers. AI help is optional at every stage.
2. Add drivers yourself or generate them independently with AI. Exact-title duplicates are grouped with attribution; request semantic merge suggestions for duplicates and redundant broader/narrower drivers, or add, edit, merge, split and remove drivers yourself. Proposed semantic merges require acceptance and preserve meaningful distinctions for the exercise.
3. Record source links, research notes, score rationale and represented or missing perspectives in each driver assessment; these notes autosave and travel into analytical reports and backups. Unscored inputs begin blank, and AI comparisons stay collapsed until requested. Enter and approve your own humanitarian-impact and uncertainty scores, or generate independent AI scores. Inspect all model positions, adjust scores numerically, or explicitly accept the remaining per-axis medians. Missing ratings remain missing; even-sized medians retain fractional values.
4. Select critical uncertainties. Important, predictable drivers stay in the record; explicitly capture shared background assumptions in Define analysis. At least one is required; four to six is a useful guide. Selected drivers remain visible as removable chips.
5. Develop hypotheses one uncertainty at a time. The coverage summary names missing uncertainties; the review queue shows counts and approval status. Add alternatives yourself or generate for one uncertainty or the whole set. Organise hypotheses to merge, split or remove them, then approve each uncertainty or approve all retained hypotheses and continue to combinations.
6. Build scenario combinations. Generate three candidates per model, add your own, or optionally Explore a disruption to create one surprising candidate per model. Choose any number of combinations to take into writing, with at least one required. The optional disruption prompt can describe a particular “What if…?”; left blank, the model proposes one. Additional drivers require review and acceptance or removal, and remain unscored. Generation starts with one model selected; add more perspectives in the cost confirmation. Compare candidates, edit their explanations, remove or restore combinations, then approve your selection and start writing. New manual combinations have Create and Cancel actions and are saved only on creation. Outcomes not chosen yet prevent approval; deliberately unresolved outcomes remain explicit.
7. Write and review scenarios together. Draft each story from its approved combination in the rich-text/Markdown editor, use the optional checklist in the same editor, then save the final set and continue straight to export. Optional AI edits and starting drafts remain proposals to apply or dismiss explicitly; original/working/final snapshots and undo/redo preserve your writing.
8. Copy or export Markdown, Word, PDF, full analytical reports, analytical JSON and resumable project JSON. Word and PDF always include a visual overview of the chosen critical uncertainties, an impact/uncertainty matrix with score provenance, a paired scenario comparison and individual hypothesis chains. Optional annotations add hypothesis descriptions and recorded assumptions; the full analytical record adds research, decisions, reasoning and operation history.

Writing and final review share one navigation stage. A draft for every selected scenario is required to save the final set; checklist boxes are optional. Earlier saved scenarios reopen in the combined workspace with their drafts, snapshots, decisions and model history preserved.

Approvals and generation are separate actions. New, manually authored drivers and hypotheses offer **Add and approve** as an explicit alternative to adding for later review. Editing never runs models. Upstream changes flag downstream work without deleting it. General exercise undo/redo covers local decisions; it resets at model-operation boundaries and never reverses recorded spending. Narrative editing has its own text history.

Each stage explains its completion requirements and offers a direct next action. Missing scores and narratives have named review links; combination approval explains empty selections and invalid references before submission. Driver and hypothesis checkboxes appear only in organisation mode, while uncertainty and combination checkboxes explicitly choose the scenario set. Approval actions can continue directly to the next stage. Export shows the current draft/final state and the contents of the selected download options.

The combination workspace shows the candidate count, visible comparison range and selected count. Its chooser lists all active combinations together and saves inclusion changes immediately. There are no main/wildcard categories or final selection targets. Explanations start from the original model contribution and autosave; an intentionally empty explanation stays empty. Selection and analytical changes require renewed approval before final narrative snapshots can be saved. Removed combinations retain their writing, notes and snapshots in project backups, and restore unselected for review. They are omitted from active writing, model requests and report exports. There is no separate coherence recheck action. Earlier model reasoning and historical operation records remain available, and edits require analyst review and approval. Legacy target/type fields are preserved in version 1.0 backups but never restrict selection.

Stages with creation actions share one action bar below their guidance: Generate (sparkles), Suggest merges where applicable (merge), then manual entry (plus). The bar stays below the header while scrolling. Search, view and scope controls appear to its right. Hypothesis generation can target all uncertainties, the current one or those missing hypotheses; manual additions let you choose the uncertainty before saving. Writing has the same page-level Generate draft and manual writing actions. Scenario cards open their stories directly; with multiple scenarios, the action buttons ask which named story to use. A single scenario opens directly, without a separate selector.

Merge reviews show the proposed combined record alongside its sources, with an explicit account of which record will be updated and which others will leave the active list on acceptance. Accepted and dismissed decisions remain visible, including after reload. Driver assessments show an inline result summary with returned driver/model counts, missing coverage and outstanding approvals; expand it to inspect current AI medians and open a driver's assessment. Partial results remain available, and neither operation approves records automatically.

## Storage and privacy

- Projects autosave to IndexedDB in this browser. “Saved on this device” appears only after the write transaction completes.
- Download **project backups** regularly. Browser storage may be cleared or evicted. Importing a backup creates a separate exercise.
- Version `1.0` backups are validated, including analytical references. Unsupported versions fail safely; no older-version migration is currently needed.
- The production service worker caches the application shell for offline review/editing after a successful first load. It never caches OpenRouter responses or keys. AI operations need connectivity.
- Research notes and driver source links are retained locally and excluded from model requests. Background assumptions are included in model context. The launch dialog lets you inspect the exact task information before running.
- Use only public, non-sensitive information. Prompts leave the browser through OpenRouter and the selected providers. Do not enter personal data, confidential operations or sensitive security assessments. Local storage is not confidential storage.
- No accounts, analytics, trackers, cloud project storage, environment credentials or third-party scripts are used. Fonts and application dependencies are bundled locally.

## AI and spending behaviour

Individual-model requests use OpenRouter’s [Chat Completions API](https://openrouter.ai/docs/api/reference/overview); each receives the same analyst context without the other models’ responses, model-level fallback, tools or searches. [Fusion](https://openrouter.ai/docs/guides/routing/routers/fusion-router) uses the Responses API with required panel consultation, its Quality panel, web tools and High panel reasoning. It produces one combined contribution rather than separate panel scores. Requested aliases and resolved model IDs are recorded separately. Responses are validated locally with Zod; malformed responses remain inspectable and require explicit retry.

Two workers process requests concurrently. Driver assessments use batches of at most ten drivers per model, with the same batches supplied independently to each model. Generate combinations requests three candidates per selected model; Explore a disruption requests one per model. Existing candidate choices are frozen as contrast context for the whole operation, so partial results do not invalidate other contributions. Individual calls have a 180-second timeout; Fusion has a ten-minute timeout and supports cancellation. Most tasks reserve room for 6,000 final-output tokens; combination batches reserve 12,000–20,000. Reasoning effort increases the total output allowance using OpenRouter’s effort fractions, capped by the provider limit and 64,000 tokens. An explicit retry of a truncated combination batch increases its allowance, up to the model limit or 64,000 tokens. The launch dialog shows the actual output allowance, total request count and estimate from the same plan used for dispatch. Fusion shares the overall exercise budget with every other model and has no separate planning allowance. Its variable pricing requires an exercise budget with money remaining; that remainder is reserved automatically across the run’s batches and reconciled with actual reported charges. Retries use the current remaining budget. The reservation is never presented as a guaranteed maximum price. Estimates use live catalogue prices and conservative input allowances; the complete operation is reserved before dispatch. Returned usage costs are reconciled separately from reserved estimates and unknown charges. Unknown charges retain their allowance conservatively until the user adjusts the budget. This is app-side admission control, **not a hard external spending cap**. A dedicated spending-limited OpenRouter key is recommended.

Partial successes remain visible as batches finish. All structured tasks use their corresponding strict JSON Schema output when the catalogue advertises support, with requests requiring compatible provider endpoints. Combination schemas constrain the batch count and kind, item count and approved driver/hypothesis pairs; every disruption candidate must also include every selected uncertainty or explicit null. JSON mode or prompt-only output is used for other models according to their advertised capabilities. Local validation always applies because schema enforcement varies by provider. Operation records retain raw responses, completion reasons, usage and costs, and distinguish output-limit truncation from JSON syntax and validation failures. Combination reference errors identify the affected combination and missing, duplicate or invalid entries. Retry targets a failed contribution; ratings retries request only missing cells within that batch for the selected model, and combination retries repeat only the failed batch. Older unbatched combination runs retain their saved scope and are split into bounded retry batches. Replacement models are selected explicitly in the launch dialog, which recalculates their work and estimate. No automatic repair or retry calls are made. Cancellation stops queued calls and aborts local requests, but dispatched requests may still be billed. Reloaded in-flight operations become interrupted failures with truthful unknown-charge records.

The top-bar **Model activity** control shows running and queued request counts across the current exercise. Click it for status details, unread results, errors, cancellation and links to full operation records. **Clear history** hides finished popup entries on this device, including after reload; it preserves the underlying records, model contributions and spending totals. Status animations respect reduced-motion preferences.

Recommended model IDs are a small release-time configuration in `src/lib/domain/project.ts`, verified against the live catalogue before paid execution. Update this configuration as availability and capabilities change. Per-stage overrides are supported. Semantic consolidation is a separate, explicit synthesis operation over collected contributions.

In the launch dialog, combination generation and disruption exploration start with only the first configured model selected. Select additional contributors when useful, or uncheck contributors you want to skip for that run. Select at least one model; the request count, estimate and Run button update to reflect the selection. Whole-exercise and per-stage model settings remain available for subsequent runs.

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

### Updating the roadmap

Edit [ROADMAP.md](ROADMAP.md) to update both the repository roadmap and the app's **How it works → Roadmap** tab. Vite imports the Markdown file directly, so development updates appear through hot reload and production updates are included in the next build. The existing GitHub Pages workflow rebuilds and deploys on pushes to `main`; no separate copy of the tab content needs editing. The bundled roadmap also remains available offline with the app.

### Application modules

| Location                | Responsibility                                                                            |
| ----------------------- | ----------------------------------------------------------------------------------------- |
| `src/lib/domain/`       | Versioned schema, judgements, revisions, dependencies, consolidation and authored example |
| `src/lib/ai/`           | OpenRouter transport, prompts, structured validation, orchestration and cost admission    |
| `src/lib/storage/`      | IndexedDB transactions, preferences and interrupted-run recovery                          |
| `src/lib/components/`   | Analytical workspaces, inspector, editor and accessible dialogs                           |
| `src/lib/export/`       | Portable/analytical JSON, Markdown, DOCX and paginated PDF                                |
| `src/service-worker.ts` | Production shell caching, excluding model traffic                                         |
| `design/tokens.css`     | Supplied Common Ground visual tokens                                                      |

The interface uses self-hosted Nunito Sans. The font's OFL licence is in `src/lib/assets/OFL.txt`; PDF reports embed static regular, bold, italic and bold italic faces (see `src/lib/assets/README.md` for regeneration). Word reports use editable Calibri styles and tables, with a high-resolution matrix and a text key. The rich-text schema supports headings, paragraphs, bold, italic, lists, quotes and code; arbitrary HTML is not rendered into the application.

## Verification and remaining release checks

See [verification notes](VERIFICATION.md) for automated tests, browser scenarios, export checks and explicit limits. Live paid inference, provider-specific output reliability, a complete four-browser/screen-reader audit and the five-analyst pilot still require validation before public release. These are not implied by the authored example or the mocked tests.

The existing repository licence is retained. See [LICENSE](LICENSE) and [CONTRIBUTING.md](CONTRIBUTING.md).
