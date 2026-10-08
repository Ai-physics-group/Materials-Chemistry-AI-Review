# Errors

Command failures and integration errors.

---

## [ERR-20260916-010] claude-code-restricted-oauth-conflict

**Logged**: 2026-09-16T17:10:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: integration

### Summary
Claude Code 2.1.270 returned `Not logged in` when the application combined OAuth authentication with `--restricted`.

### Error
The CLI exited with code 1 and a structured result containing `terminal_reason=api_error`, zero input tokens, and `result=Not logged in · Please run /login`.

### Context
- `claude auth status` reported a valid OAuth login.
- The same print-mode call succeeded with `--safe-mode --tools ""`.
- Adding only `--restricted` reproduced the zero-token failure.

### Suggested Fix
Keep `--safe-mode` and an empty tool set, but do not use `--restricted` with this OAuth-backed local integration.

### Metadata
- Reproducible: yes
- Related Files: backend/app/claude_code.py

### Resolution
- **Resolved**: 2026-09-16T17:14:00+08:00
- **Notes**: Removed `--restricted` and improved structured CLI error extraction.

---

## [ERR-20260916-008] malformed-ripgrep-alternation

**Logged**: 2026-09-16T15:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tooling

### Summary
A cleanup search used one over-escaped ripgrep regular expression and failed to parse.

### Error
`regex parse error: unclosed group`

### Context
- The intended check combined several literal phrases with a call-expression pattern.
- No files or running processes were changed.

### Suggested Fix
Use separate `rg -e` literal/pattern arguments for mixed searches.

### Metadata
- Reproducible: yes
- Related Files: backend/app/collab/skills.py
- Recurrence-Count: 2

### Resolution
- **Resolved**: 2026-09-16T15:01:00+08:00
- **Notes**: Re-ran the search with separate `-e` expressions.

---

## [ERR-20260916-007] failed-artifact-test-invalidated-by-new-guard

**Logged**: 2026-09-16T00:00:00+08:00
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
A collaboration integration test was written before the new evidence-table write guard and later stopped reaching its intended quarantine path.

### Error
The expected failed-artifact quarantine event was absent after `write_file` began rejecting direct writes to `evidence_table.csv`.

### Context
- The test fixture attempted to create an invalid `evidence_table.csv` through `write_file`.
- The stronger `record_evidence` contract correctly rejected that write before any file existed.

### Suggested Fix
Use an ordinary unverified draft file to exercise failed-output quarantine independently of evidence-table validation.

### Metadata
- Reproducible: yes
- Related Files: backend/tests/test_collab.py

### Resolution
- **Resolved**: 2026-09-16T00:00:00+08:00
- **Notes**: Updated the fixture to create `unverified_notes.md`; also retained full mock-state reset as defensive isolation.

---

## [ERR-20260916-006] apply-patch-stale-test-context

**Logged**: 2026-09-16T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
An `apply_patch` insertion used an assertion line that did not exactly match the current test file.

### Error
`apply_patch verification failed: Failed to find expected lines`

### Context
- The patch was rejected atomically, so no partial edit occurred.
- The intended change is a new writer file-access behavior test.

### Suggested Fix
Read the nearby test block and anchor the patch on the exact current function boundary.

### Metadata
- Reproducible: yes
- Related Files: backend/tests/test_collab_quality.py

### Resolution
- **Resolved**: 2026-09-16T00:00:00+08:00
- **Notes**: Retried against current file context.

---

## [ERR-20260916-005] ripgrep-windows-directory-glob

**Logged**: 2026-09-16T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: backend

### Summary
Passed a Windows path containing `*.py` directly to ripgrep, which Windows treated as an invalid path.

### Error
`IO error ... 文件名、目录名或卷标语法不正确。 (os error 123)`

### Context
- Earlier parts of the read-only inspection succeeded.
- No application files were changed by the failed search.

### Suggested Fix
Pass the directory to `rg` and use `-g '*.py'` for file filtering.

### Metadata
- Reproducible: yes
- Related Files: backend/app/collab

### Resolution
- **Resolved**: 2026-09-16T00:00:00+08:00
- **Notes**: Continued with directory-scoped search syntax.

---

## [ERR-20260916-004] powershell-pipeline-after-foreach

**Logged**: 2026-09-16T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
A PowerShell diagnostic command piped directly after a `foreach` statement without wrapping or collecting its output.

### Error
`ParserError: An empty pipe element is not allowed.`

### Context
- The command was only intended to summarize source file sizes and symbols.
- Parsing failed before any source inspection or modification occurred.

### Suggested Fix
Assign `foreach` output to a variable, then pipe that variable to `Format-Table`.

### Metadata
- Reproducible: yes
- Related Files: none

### Resolution
- **Resolved**: 2026-09-16T00:00:00+08:00
- **Notes**: Retried with an intermediate collection variable.

---

## [ERR-20260916-003] pytest-backend-import-path

**Logged**: 2026-09-16T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Running backend tests from the project root failed because the `backend` directory was not on Python's import path.

### Error
`ModuleNotFoundError: No module named 'app'`

### Context
- Command was launched from the project root against `backend/tests/test_collab_quality.py`.
- This is a test invocation issue, not an application regression.

### Suggested Fix
Run pytest with `backend` as the working directory (or set `PYTHONPATH=backend`).

### Metadata
- Reproducible: yes
- Related Files: backend/tests/test_collab_quality.py

### Resolution
- **Resolved**: 2026-09-16T00:00:00+08:00
- **Notes**: Retried from the backend working directory.

---

## [ERR-20260916-002] git-history-unavailable

**Logged**: 2026-09-16T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
Attempted to inspect commit history in `xueshu`, but the project directory is not a Git repository.

### Error
`fatal: not a git repository (or any of the parent directories): .git`

### Context
- Diagnosis can still compare preserved run events/artifacts with current safeguards.
- No files were changed by the failed Git commands.

### Suggested Fix
Check for `.git` before using history commands; rely on task event logs and backups when version history is unavailable.

### Metadata
- Reproducible: yes
- Related Files: data/collab

### Resolution
- **Resolved**: 2026-09-16T00:00:00+08:00
- **Notes**: Continued diagnosis using persisted artifacts and current code.

---

## [ERR-20260916-001] ripgrep-nonexistent-search-root

**Logged**: 2026-09-16T00:00:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
An `rg` diagnostic command included a nonexistent top-level `tests` path even though this project stores tests under `backend/tests`.

### Error
`rg: tests: 系统找不到指定的文件。 (os error 2)`

### Context
- The command still returned useful matches from `backend` and `frontend`.
- No project behavior or files were affected.

### Suggested Fix
Use only verified search roots (`backend`, `frontend`) or run `rg --files` before composing a scoped search.

### Metadata
- Reproducible: yes
- Related Files: backend/tests

### Resolution
- **Resolved**: 2026-09-16T00:00:00+08:00
- **Notes**: Continued with verified project paths.

---

## [ERR-20260916-002] powershell-rest-array-wrapping

**Logged**: 2026-09-16T12:15:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
Wrapping an `Invoke-RestMethod` JSON-array result in `@(...)` produced a nested value and an empty task id in a verification request.

### Error
The verification request returned HTTP 404 `协作任务不存在` instead of exercising the intended finished-task route.

### Context
- This was a post-deploy rejection check only; no state was changed.
- The task list itself was healthy and contained valid ids.

### Suggested Fix
Inspect the JSON shape first or use one explicit verified task id for a non-mutating rejection check.

### Metadata
- Reproducible: yes
- Related Files: backend/app/collab/routes.py

### Resolution
- **Resolved**: 2026-09-16T12:16:00+08:00
- **Notes**: Retried with an explicit finished task id and confirmed HTTP 409.

---

## [ERR-20260916-001] collab-message-select-missing-from

**Logged**: 2026-09-16T11:55:00+08:00
**Priority**: low
**Status**: resolved
**Area**: backend

### Summary
Adding delivery-state fields to the collaboration message query accidentally removed its FROM clause.

### Error
`sqlite3.OperationalError: no such column: id`

### Context
- The integration test queued a live instruction and then fetched the member message list.
- The SELECT listed the correct columns but omitted `FROM collab_messages`.

### Suggested Fix
Keep the full SQL statement visible when extending selected columns, then rerun the public API integration test.

### Metadata
- Reproducible: yes
- Related Files: backend/app/collab/orchestrator.py

### Resolution
- **Resolved**: 2026-09-16T11:56:00+08:00
- **Notes**: Restored the FROM clause and reran the live-instruction delivery-state test.

---

## [ERR-20260915-007] powershell-directory-size-pipeline

**Logged**: 2026-09-15T17:10:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
A read-only PowerShell directory-size pipeline had an extra closing brace before a pipe.

### Error
`ParserError: An empty pipe element is not allowed.`

### Context
- The command only attempted to report storage usage.
- No files or database rows were changed.

### Suggested Fix
Accumulate objects in an array inside nested loops, then sort and format the array afterward.

### Metadata
- Reproducible: yes
- Related Files: data/projects, data/reports, data/collab

### Resolution
- **Resolved**: 2026-09-15T17:10:00+08:00
- **Notes**: Replaced the faulty pipeline with an explicit accumulator.

---

## [ERR-20260915-006] rg-combined-pattern

**Logged**: 2026-09-15T17:05:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
A combined ripgrep regular expression used for final line-number lookup had an unclosed group.

### Error
`rg: regex parse error: unclosed group`

### Context
- Only the reporting lookup failed; source edits and regression tests were unaffected.
- The pattern mixed escaped brackets, braces, quotes, and alternation unnecessarily.

### Suggested Fix
Use separate fixed-string `rg -F` lookups for unrelated source markers.

### Metadata
- Reproducible: yes
- Related Files: backend/app/collab/quality.py, backend/app/collab/agents.py

### Resolution
- **Resolved**: 2026-09-15T17:05:00+08:00
- **Notes**: Replaced the combined regex with fixed-string searches.

---

## [ERR-20260915-002] chrome-headless-screenshot

**Logged**: 2026-09-15T13:06:00+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
The first headless Chrome screenshot check returned before the image file appeared.

### Error
The immediate file check reported that `initial.png` did not exist.

### Context
- Chrome completed the screenshot asynchronously on Windows.
- A later read-only check found the image at the expected path.

### Suggested Fix
Poll briefly for the output file before treating headless Chrome capture as failed.

### Metadata
- Reproducible: yes
- Related Files: dogfood-output/screenshots/initial.png

### Resolution
- **Resolved**: 2026-09-15T13:07:00+08:00
- **Notes**: Confirmed the screenshot was created successfully after the process returned.

---

## [ERR-20260915-001] agent-browser

**Logged**: 2026-09-15T12:55:00+08:00
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
The `agent-browser` executable is not available on PATH in the current PowerShell environment.

### Error
`agent-browser` was not recognized as a command.

### Context
- Attempted a read-only browser QA session against the already-running local app.
- The app itself remained available on `127.0.0.1:8765`.

### Suggested Fix
Locate the bundled executable or use an existing browser-control capability; do not install globally without user intent.

### Metadata
- Reproducible: yes
- Related Files: dogfood-output/report.md

---

## [ERR-20260915-003] pytest-command-path

**Logged**: 2026-09-15T13:36:01+08:00
**Priority**: low
**Status**: resolved
**Area**: tests

### Summary
Calling `pytest` directly failed because the project virtual environment is not on PATH.

### Error
`pytest` was not recognized as a PowerShell command.

### Context
- The dependencies were installed correctly in `.venv`.
- The README already documents the explicit interpreter form.

### Suggested Fix
Run backend tests through `.venv\Scripts\python.exe -m pytest`.

### Metadata
- Reproducible: yes
- Related Files: README.md

### Resolution
- **Resolved**: 2026-09-15T13:36:01+08:00
- **Notes**: Re-ran the full suite with the project interpreter; all 16 tests passed.

---

## [ERR-20260915-004] stale-mock-prompt-marker

**Logged**: 2026-09-15T13:36:01+08:00
**Priority**: medium
**Status**: resolved
**Area**: tests

### Summary
The first full smoke run missed document evidence because its mock server still detected the retired prompt persona.

### Error
The report evidence assertion failed while all other smoke checks passed.

### Context
- The production document prompt was reframed for materials chemistry and AI.
- The mock dispatch marker still looked for the old generic document-assistant wording.

### Suggested Fix
Keep mock routing markers aligned with stable prompt identifiers whenever prompt personas change.

### Metadata
- Reproducible: yes
- Related Files: backend/tests/mock_openai_server.py, backend/app/pipeline.py

### Resolution
- **Resolved**: 2026-09-15T13:36:01+08:00
- **Notes**: Updated the marker and confirmed the complete smoke suite passes.

---

## [ERR-20260915-005] combined-service-restart-command

**Logged**: 2026-09-15T13:41:00+08:00
**Priority**: low
**Status**: resolved
**Area**: infra

### Summary
A compound PowerShell command combining process stop, database backup, restart, and verification was rejected by the execution policy.

### Error
The command was rejected before execution; the running service and database were unchanged.

### Context
- The target process had already been verified as this project's uvicorn listener on port 8765.
- The same operations were safe when issued as small, explicit commands.

### Suggested Fix
Keep service lifecycle operations separate: back up, stop the exact PID, start, then verify health.

### Metadata
- Reproducible: unknown
- Related Files: scripts/start.ps1
- Recurrence-Count: 3
- Last-Seen: 2026-09-16T11:30:00+08:00

### Resolution
- **Resolved**: 2026-09-15T13:41:00+08:00
- **Notes**: Backed up SQLite and restarted only the verified listener; health and the new update route were confirmed.

---

## [ERR-20260916-009] pytest-launched-from-repository-root

**Logged**: 2026-09-16T15:05:00+08:00
**Priority**: low
**Status**: resolved
**Area**: testing

### Summary
Focused backend tests were launched from the repository root, where the `app` package is not on Python's import path.

### Error
`ModuleNotFoundError: No module named 'app'`

### Context
- All six selected tests failed during import/fixture setup, before exercising application code.
- The established test command runs from `backend` with the repository virtual environment.

### Suggested Fix
Run backend pytest commands with `backend` as the working directory.

### Metadata
- Reproducible: yes
- Related Files: backend/tests/test_collab.py, backend/tests/test_collab_quality.py

### Resolution
- **Resolved**: 2026-09-16T15:06:00+08:00
- **Notes**: Re-ran the same six tests from `backend`; all passed.

---
