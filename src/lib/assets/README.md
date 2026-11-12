# Report fonts

PDF reports embed static Nunito Sans faces because the PDF writer does not apply variable-font axes. Regular and bold use the bundled variable source. Italic and bold italic combine the Latin, Latin extended, Cyrillic, Cyrillic extended and Vietnamese subsets from the installed `@fontsource-variable/nunito-sans` package.

All faces retain the SIL Open Font License in [OFL.txt](OFL.txt). To regenerate the additional report faces, install Python `fonttools` and `brotli`, then run `python scripts/generate-report-fonts.py` from the repository root. No font conversion or external font request occurs during application builds or exports.
