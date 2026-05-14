import { execFileSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("./dev-down.sh", import.meta.url));
const repoRoot = dirname(dirname(scriptPath));
const temporaryDirectories = [];

afterEach(() => {
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();

    if (directory) {
      rmSync(directory, { force: true, recursive: true });
    }
  }
});

describe("dev-down.sh", () => {
  it("tears down the default services and the routing profile together", () => {
    const temporaryDirectory = mkdtempSync(
      join(tmpdir(), "pathbadger-dev-down-test-"),
    );
    const dockerStubPath = join(temporaryDirectory, "docker");
    const logPath = join(temporaryDirectory, "docker.log");

    temporaryDirectories.push(temporaryDirectory);

    writeFileSync(
      dockerStubPath,
      `#!/usr/bin/env bash
printf '%s\n' "$*" >> "${logPath}"
`,
    );
    chmodSync(dockerStubPath, 0o755);

    execFileSync("bash", [scriptPath], {
      cwd: repoRoot,
      env: {
        ...process.env,
        PATH: `${temporaryDirectory}:${process.env.PATH ?? ""}`,
      },
    });

    expect(readFileSync(logPath, "utf8").trim()).toBe(
      "compose --profile maps down --remove-orphans",
    );
  });
});
