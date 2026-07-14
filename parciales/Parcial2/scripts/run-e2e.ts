const composeFile = "docker-compose.e2e.yml";

async function run(command: string[], allowFailure = false) {
  const process = Bun.spawn(command, {
    cwd: import.meta.dir + "/..",
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
    env: { ...Bun.env },
  });
  const exitCode = await process.exited;
  if (exitCode !== 0 && !allowFailure) {
    throw new Error(`Falló el comando: ${command.join(" ")} (exit ${exitCode})`);
  }
  return exitCode;
}

await run(["docker", "compose", "-f", composeFile, "down", "-v", "--remove-orphans"], true);

try {
  await run(["docker", "compose", "-f", composeFile, "up", "-d", "--wait", "mongo-e2e"]);
  await run(["docker", "compose", "-f", composeFile, "run", "--rm", "mongo-e2e-init"]);
  const exitCode = await run(["bun", "x", "playwright", "test"], true);
  if (exitCode !== 0) process.exitCode = exitCode;
} finally {
  await run(["docker", "compose", "-f", composeFile, "down", "-v", "--remove-orphans"], true);
}
