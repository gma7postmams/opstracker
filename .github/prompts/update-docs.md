Analyze the changed files and verify documented behavior against the implementation. Use only behavior that exists; do not invent functionality.

## Documentation Update Process

Before updating documentation:

1. Read `docs/DOC_MAP.md`.
2. Identify changed files.
3. Determine which documentation files own those code areas.
4. Update only the mapped documentation.
5. Always update `CHANGELOG.md` for user-visible changes.
6. Update `FEATURES.md` when functionality changes.
7. Update `README.md` only for setup, architecture, deployment, or major capability changes.
8. Avoid unrelated documentation updates.
9. If multiple areas are modified, update documentation for all affected areas.

If changed files belong to Authentication & Login in `docs/DOC_MAP.md`, update `docs/authentication.md`. Update `docs/workflow.md` only when the change also alters the overall operational workflow.

If no documentation changes are required:

- Explicitly state: `Documentation is already synchronized with the current implementation.`
- Summarize the files reviewed.
- Explain why no documentation updates were necessary.
- Do not propose unnecessary documentation edits.

Keep documentation concise, accurate, and commit-ready. Update screenshot references only when affected.