# OpsTracker Repository Rules

Documentation is required for every completed feature, fix, refactor, or database change.

Before suggesting a commit:

1. Analyze all modified files.
2. Read `docs/DOC_MAP.md`.
3. Determine documentation ownership for the changed files.
4. Update only documentation mapped to the affected areas.
5. Update `CHANGELOG.md` for user-visible changes.
6. Update `FEATURES.md` when functionality changes.
7. Update `README.md` only for setup, installation, architecture, deployment, or major capability changes.

Document when applicable:

- New features
- Updated features
- Database changes
- Workflow changes
- Permission changes
- Reporting changes
- AI changes
- Authentication changes
- Administration changes

Requirements:

- Use actual implementation only.
- Do not invent functionality.
- Keep documentation synchronized with the current codebase.
- Follow `docs/DOC_MAP.md` ownership rules.
- Avoid unrelated documentation updates.
- Documentation must be commit-ready.

## Code Navigation Process

Before investigating, implementing, refactoring, or fixing a feature:

1. Read `docs/SYSTEM_MAP.md`.
2. Identify the feature area.
3. Open the mapped files first.
4. Search the wider repository only when necessary.
5. Use `docs/DOC_MAP.md` to determine documentation ownership.

This map should help reduce unnecessary repository-wide searches and improve consistency when working on feature-specific changes.