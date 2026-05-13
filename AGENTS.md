# AGENTS.md

<INSTRUCTIONS>
@/Users/cpf/.codex/RTK.md

Before running any shell command for this repository, source `~/.zprofile` and `~/.zshrc` in the same shell invocation so the expected `rtk`, `npm`, and Node toolchain are on `PATH`.

Preferred pattern:

```bash
source ~/.zprofile >/dev/null 2>&1; source ~/.zshrc >/dev/null 2>&1; rtk <command>
```

Do not report missing `npm`, `node`, or `rtk` until that bootstrap step has been attempted in the current shell.
</INSTRUCTIONS>
