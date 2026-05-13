# AGENTS.md

<INSTRUCTIONS>
@/Users/cpf/.codex/RTK.md

Before running any shell command for this repository, source `~/.zprofile` and `~/.zshrc` in the same shell invocation so the expected `rtk`, `npm`, and Node toolchain are on `PATH`.

Preferred pattern:

```bash
source ~/.zprofile >/dev/null 2>&1; source ~/.zshrc >/dev/null 2>&1; rtk <command>
```

Do not report missing `npm`, `node`, or `rtk` until that bootstrap step has been attempted in the current shell.

This repository also defines four primary agent commands that must be interpreted as repo tasks, not generic natural-language requests:

- `show`
- `refine`
- `implement`
- `review`

When the user says exactly `show`, do not ask what they want to inspect. Read the current workspace state and reply briefly with:

- open backlog item count from `.agent/backlog/*` where `status != done`
- incomplete epic count from `.agent/epics/*` where `status != done`
- overall roadmap progress percent from `.agent/roadmap.yaml` `roadmap.overall_progress_percent`

`show` is read-only. It must not modify files, commit, or push.

Use `scripts/show-workspace-summary.sh` after the shell bootstrap step when you want the repo-native summary output.
</INSTRUCTIONS>
