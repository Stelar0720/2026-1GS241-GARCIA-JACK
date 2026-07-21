// Disparo de los pipelines de CI y CD desde el MCP (HU-046, HU-047).
//
// El API no reimplementa nada: reenvía un `workflow_dispatch` a la API de GitHub
// Actions con un token de repositorio, y devuelve el run más reciente para que
// el agente pueda seguirlo. Sin token configurado el endpoint responde 503 en
// lugar de fallar de forma opaca.

const OWNER_REPO = process.env.GITHUB_REPOSITORY?.trim() || "Stelar0720/2026-1GS241-GARCIA-JACK";

export const WORKFLOWS = {
  ci: process.env.GITHUB_CI_WORKFLOW?.trim() || "urbansprout-ci.yml",
  deploy: process.env.GITHUB_CD_WORKFLOW?.trim() || "urbansprout-cd.yml",
} as const;

export type PipelineKind = keyof typeof WORKFLOWS;

export class PipelineUnavailableError extends Error {}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    throw new PipelineUnavailableError("GITHUB_TOKEN no está configurado; el disparo de pipelines está deshabilitado.");
  }
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

export async function triggerWorkflow(kind: PipelineKind, input: { ref?: string; inputs?: Record<string, string> } = {}) {
  const headers = githubHeaders();
  const workflow = WORKFLOWS[kind];
  const ref = input.ref?.trim() || (kind === "deploy" ? "production" : "main");

  const dispatch = await fetch(
    `https://api.github.com/repos/${OWNER_REPO}/actions/workflows/${encodeURIComponent(workflow)}/dispatches`,
    { method: "POST", headers, body: JSON.stringify({ ref, ...(input.inputs ? { inputs: input.inputs } : {}) }) },
  );
  if (!dispatch.ok) {
    const detail = await dispatch.text().catch(() => "");
    throw new Error(`GitHub rechazó el disparo (${dispatch.status}): ${detail.slice(0, 300)}`);
  }

  return { workflow, ref, dispatched: true };
}

export async function latestRuns(kind: PipelineKind, limit = 5) {
  const headers = githubHeaders();
  const response = await fetch(
    `https://api.github.com/repos/${OWNER_REPO}/actions/workflows/${encodeURIComponent(WORKFLOWS[kind])}/runs?per_page=${Math.min(Math.max(limit, 1), 20)}`,
    { headers },
  );
  if (!response.ok) throw new Error(`GitHub respondió ${response.status} al listar ejecuciones.`);
  const body = (await response.json()) as {
    workflow_runs?: { id: number; status: string; conclusion: string | null; head_branch: string; html_url: string; created_at: string }[];
  };
  return (body.workflow_runs ?? []).map((run) => ({
    id: run.id,
    status: run.status,
    conclusion: run.conclusion,
    branch: run.head_branch,
    url: run.html_url,
    createdAt: run.created_at,
  }));
}
