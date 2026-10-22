# AI and MACO

OpsTracker has two AI-backed workflows: field text improvement and MACO chat. Both use an Ollama-compatible `/api/generate` endpoint configured by `data/ai-settings.json`.

## Text improvement

Record forms can request a rewrite for problem, resolution, remarks or task description. The server prompt asks for corrected text only, preserving technical terms, IP addresses, hostnames, software names, error messages and reference numbers. The endpoint returns a `suggestion` string. The request timeout defaults to 30 seconds and can be set in the AI settings file.

If the top-level `enabled` setting is false, record forms hide their text-improvement actions and `/api/ai/improve` returns a service-unavailable response. The endpoint does not require a signed-in session.

## MACO chat

The MACO page is available only when the saved `maco.enabled` setting is true. Otherwise, it shows an administrator-disabled message, and `/api/maco/chat` rejects requests with a service-unavailable response. The sidebar reads the saved settings and updates after an admin saves AI & MACO settings. The chat route requires an authenticated session and uses the configured `maco.model` and `maco.temperature` values.

The route classifies questions and gathers relevant live context from OpsTracker before calling the model. Depending on the question, context can include:

- Visible Technical Assistance and Task records, status summaries and reference lookups.
- Similar/related records and recurring category, show/group, client or keyword patterns.
- Owner/assignee work activity, dashboard/report-style metrics and audit history.
- User account and active master-data information for relevant questions.

MACO responses include source categories and, where available, record references. The prompt instructs the model to avoid unsupported claims, distinguish observed correlations from proven causes, and keep lists bounded unless a longer list is requested. The chat UI renders Markdown and shows the provided sources.

Record visibility is applied to record queries through the shared record-visibility rule. Other context types have route-specific handling; do not infer that every user/master-data/audit lookup follows identical scoping.

## Settings and service checks

The admin page exposes the top-level enabled flag, service URL, text-improvement model and timeout, plus MACO enabled/model/temperature/search options. It also provides a connection/model check against the configured server. Settings are read from and written to `data/ai-settings.json` on the server filesystem. Saving settings causes the shared sidebar to re-read the saved configuration without requiring a new login.

In the MACO route, `maco.searchRecords` controls record search, and the route uses `maco.model` and `maco.temperature`; the `showRelatedRecords` option is not consulted there. The AI settings and test API routes currently have no authentication or administrator-role check. Protect the settings file and service endpoint operationally, and do not treat the admin UI as the API authorization boundary.

## Data handling

Questions, selected record context and limited conversation history are sent from the server to the configured model service. Configure that service with the data-handling expectations of the organization. The route logs prompt-related diagnostics and errors to the server console; avoid sending secrets in questions or record text.
