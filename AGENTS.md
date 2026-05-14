# AGENTS.md

<INSTRUCTIONS>
@/Users/cpf/.codex/RTK.md

Before running any shell command for this repository, source `~/.zprofile` and `~/.zshrc` in the same shell invocation so the expected `rtk`, `npm`, and Node toolchain are on `PATH`.

Preferred pattern:

```bash
source ~/.zprofile >/dev/null 2>&1; source ~/.zshrc >/dev/null 2>&1; rtk <command>
```

Do not report missing `npm`, `node`, or `rtk` until that bootstrap step has been attempted in the current shell.

This repository also defines five primary agent commands that must be interpreted as repo tasks, not generic natural-language requests:

- `show`
- `refine`
- `implement`
- `fix`
- `review`

When a repo task changes files, the agent must stage and create a git commit before finishing unless the user explicitly says not to commit yet. Treat commits as part of completing the task, not as an optional follow-up reminder.

When the user says `implement`, or `implement` followed by extra tokens, the agent must implement exactly one actionable backlog item.
When the user says `fix`, or `fix` followed by extra tokens, the agent must resolve exactly one open finding from `.agent/findings/*`.
Any extra tokens after `implement` or `fix` are optional focus hints only and must never widen the task into multiple unrelated changes.

When the user says `review`, or `review` followed by extra tokens, the agent must still perform a whole-workspace audit.
Any extra tokens after `review` are optional focus hints only and must never narrow the audit to a commit, diff, or file subset.
Never interpret `review <number>` as "review the latest N commits" or any other commit-limited review mode.

When the user says exactly `show`, do not ask what they want to inspect. Read the current workspace state and reply briefly with:

- open backlog item count from `.agent/backlog/*` where `status != done`
- incomplete epic count from `.agent/epics/*` where `status != done`
- overall roadmap progress percent from `.agent/roadmap.yaml` `roadmap.overall_progress_percent`

`show` is read-only. It must not modify files, commit, or push.

Use `scripts/show-workspace-summary.sh` after the shell bootstrap step when you want the repo-native summary output.
</INSTRUCTIONS>
