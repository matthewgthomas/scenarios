# Contributing

Use the product specification and Common Ground design handoff as the baseline. This build deliberately limits the implementation to Quick Mode.

Install with `npm ci`, run `npm run dev`, and check changes with `npm run check`, `npm test` and `npm run build`. Format application files with Prettier using the included configuration. Add tests for analytical correctness, persistence or paid-operation behaviour where a regression would lose work or mislead an analyst.

Preserve the key contracts: independent model contributions; analyst-owned approval; no model calls on edits; no silent substitutions; original provenance and snapshots; explicit unresolved choices; per-axis medians; truthful save and spending states; no credentials in stored projects or exports.

Use mock responses for automated tests. Do not put real API keys, confidential operational information or personal data in issues, fixtures, screenshots or logs. Report security issues privately to the repository maintainer rather than posting credentials or exploit details publicly.

UI changes should follow `design/tokens.css`, support keyboard use and narrow desktop/zoom reflow, and be visually reviewed in light and dark appearances. Record important verification and any limitations in the pull request.
