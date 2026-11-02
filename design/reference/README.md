# Common Ground reference

- [common-ground.html](common-ground.html): standalone, interactive design reference. Open directly in a browser; no app installation or API key is needed.
- [common-ground.png](common-ground.png): light-appearance screenshot for offline review.
- [common-ground-dark.png](common-ground-dark.png): dark-appearance screenshot.
- [common-ground.fragment.html](common-ground.fragment.html): editable source of the reference, with scoped CSS and illustrative interaction code.

The reference preserves the selected Common Ground concept. The cost-of-living exercise, model names, costs, reasoning and completion states are illustrative. It is a visual/interaction example, not the application implementation or an importable project.

Try selecting a hypothesis cell, inspecting Model A/B/C, changing the selected hypothesis to `Unresolved`, and approving/undoing approval. Edits affect this demonstration only. No model requests or real paid operations are made. Navigation, model settings, save indicators and cost reporting are presentation only; this reference does not implement durable project storage.

The generated HTML includes the preview styles and host wrapper, and loads Google Fonts, Lucide icons and floating-UI helpers from public CDNs. Full visual fidelity requires a network connection; the local interaction code and fallback fonts remain available without those resources. Screenshots require no network. Follow [DESIGN.md](../../DESIGN.md) and [tokens.css](../tokens.css) when building the Svelte app; do not adopt the preview wrapper/runtime, the fixed preview height, example model identities or the compact prototype text sizes as production code. Bundle production dependencies and self-host the delivered font assets as described in the design brief.

The generated page is portable and does not require Codex. The source fragment is included for inspection and editing; if regenerating with the original visualization tooling, use its `scripts/render.py common-ground.fragment.html common-ground.html --force` command. Regeneration is optional and that tool is not an application dependency.

Validation is limited to the reference served locally: light/dark visual inspection, 1024/1280px layout checks, the demonstrated local interactions, and browser-console inspection. The 88-token stylesheet was also loaded in a browser in both appearances; 80 intended token-pair/theme combinations passed numerical contrast checks (minimum text contrast 4.69:1; minimum tested control/mark contrast 3.56:1). These checks are not a completed accessibility audit, a cross-browser certification or a validation of the analytical examples. See [ACCEPTANCE.md](../ACCEPTANCE.md) for the production review checklist.
