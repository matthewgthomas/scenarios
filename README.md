# Scenario Designer

A local-first, analyst-led workbench for constructing humanitarian scenarios with independent model perspectives. Built from [the product specification](spec.md), [Common Ground](DESIGN.md) and its supplied design tokens.

This implementation covers **Quick Mode only**. It does not perform external research or provide Research Mode.

## Run locally

Use Node.js 22 and npm:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Choose **Explore an example** to try the complete workflow without a key. The example is authored illustrative material, visibly labelled throughout; its scores and narratives are not model outputs.

To work on your own question, create an exercise and open **Models & budget**. Paste an [OpenRouter key](https://openrouter.ai/keys), test it, choose available models and an optional USD allowance. Credits and model requests are billed by OpenRouter. Keys remain in memory only and must be re-entered after a page reload.

## Workflow

1. Frame an analytical question and horizon; optionally add preliminary drivers.
2. Generate drivers independently. Exact-title duplicates are grouped with attribution; request semantic merge suggestions or add, edit, merge, split and remove drivers yourself. Proposed semantic merges require acceptance.
3. Generate independent humanitarian-impact and uncertainty scores. Inspect all model positions, adjust scores numerically, or explicitly accept the remaining per-axis medians. Missing ratings remain missing; even-sized medians retain fractional values.
4. Select critical uncertainties. Four to six is recommended, with no enforced selection count.
5. Generate variable numbers of future-state hypotheses, inspect contributions, consolidate and approve them.
6. Generate contrasting candidate chains or add chains manually. Select main scenarios and wildcards separately. Inspect reasoning, change cells and explicitly request any paid coherence recheck. Unresolved choices remain explicit. Novel wildcard drivers require acceptance and remain unscored.
7. Draft each approved chain with a chosen primary writer. Request alternate initial drafts explicitly, compare them and choose one. All subsequent narrative editing is manual, with rich-text/Markdown modes, undo/redo and original/working/final snapshots.
8. Complete with an optional advisory checklist. Copy or export Markdown, Word, PDF, full analytical reports, analytical JSON and resumable project JSON.

Approvals and generation are separate actions. Editing never runs models. Upstream changes flag downstream work without deleting it. General exercise undo/redo covers local decisions; it resets at model-operation boundaries and never reverses recorded spending. Narrative editing has its own text history.

## Storage and privacy

- Projects autosave to IndexedDB in this browser. “Saved on this device” appears only after the write transaction completes.
- Download **project backups** regularly. Browser storage may be cleared or evicted. Importing a backup creates a separate exercise.
- Version `1.0` backups are validated, including analytical references. Unsupported versions fail safely; no older-version migration is currently needed.
- The production service worker caches the application shell for offline review/editing after a successful first load. It never caches OpenRouter responses or keys. AI operations need connectivity.
- Use only public, non-sensitive information. Prompts leave the browser through OpenRouter and the selected providers. Do not enter personal data, confidential operations or sensitive security assessments. Local storage is not confidential storage.
- No accounts, analytics, trackers, cloud project storage, environment credentials or third-party scripts are used. Fonts and application dependencies are bundled locally.

## AI and spending behaviour

The transport uses OpenRouter's [Chat Completions API](https://openrouter.ai/docs/api/reference/overview), [current-key endpoint](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-api-key) and [live model catalogue](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties). Each independent batch shares the same analyst context, without other models' responses. Calls specify one exact model ID with no model-level fallback, tools or search plugins. Responses are validated locally with Zod; malformed responses remain inspectable and require explicit retry.

Two workers process requests concurrently. Driver assessments use batches of at most ten drivers per model, with the same batches supplied independently to each model. Each call has a 180-second timeout and a 6,000-token output allowance. The launch dialog shows the total request count and estimate from the same plan used for dispatch. Estimates use live catalogue prices and conservative input allowances; the complete operation is reserved before dispatch. Returned usage costs are reconciled separately from reserved estimates and unknown charges. Unknown charges retain their allowance conservatively until the user adjusts the budget. This is app-side admission control, **not a hard external spending cap**. A dedicated spending-limited OpenRouter key is recommended.

Partial successes remain visible as batches finish. All structured tasks use their corresponding strict JSON Schema output when the catalogue advertises support, with requests requiring compatible provider endpoints. JSON mode or prompt-only output is used for other models according to their advertised capabilities. Local validation always applies because schema enforcement varies by provider. Operation records retain raw responses, completion reasons, usage and costs, and distinguish output-limit truncation from JSON syntax and validation failures. Retry targets a failed contribution; ratings retries request only missing cells within that batch for the selected model. Replacement models are selected explicitly in the launch dialog, which recalculates their missing work and estimate. No automatic repair or retry calls are made. Cancellation stops queued calls and aborts local requests, but dispatched requests may still be billed. Reloaded in-flight operations become interrupted failures with truthful unknown-charge records.

Recommended model IDs are a small release-time configuration in `src/lib/domain/project.ts`, verified against the live catalogue before paid execution. Update this configuration as availability and capabilities change. Per-stage overrides are supported. Semantic consolidation is a separate, explicit synthesis operation over collected contributions.

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
