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

## Development Workflow

After completing a feature, fix, refactor, enhancement, or UI improvement:

1. Implement the change.
2. Test the implementation.
3. Run:

   @workspace Follow .github/prompts/update-docs.md

4. Review all documentation updates.
5. Review the complete git diff.
6. Stage changes.
7. Commit changes.
8. Push changes.

Additional Guidance:

- Do not suggest a commit until required documentation has been reviewed and updated according to `docs/DOC_MAP.md`.
- Use `docs/SYSTEM_MAP.md` to locate feature-related code before performing broad searches.
- Use `docs/DOC_MAP.md` to determine documentation ownership.
- Prefer targeted file analysis over repository-wide searches when the ownership maps provide sufficient context.