import { readFile } from "node:fs/promises";
import path from "node:path";
const defaultRoot = path.resolve(import.meta.dirname, "../..");

function isCatalogSkillPath(value) {
  if (typeof value !== "string" || value.includes("\\") || value.startsWith("/")) return false;
  const parts = value.split("/");
  return parts.length >= 3
    && parts.every(part => part && part !== "." && part !== "..")
    && parts.at(-1) === "SKILL.md";
}

function excerptFrom(markdown) {
  const parts = markdown.split("---");
  let body = parts.length >= 3 ? parts.slice(2).join("---") : markdown;
  body = body.split("\n").filter(line => !line.trim().startsWith("#") && !line.trim().startsWith(String.fromCharCode(96).repeat(3))).join(" ");
  body = body.replace(/[`*_>#]/g, "").replace(/\s+/g, " ").trim();
  return body.length > 260 ? body.slice(0, 257).trimEnd() + "…" : body;
}

function candidatePaths(record) {
  if (!record || typeof record !== "object") return [];
  return [record.source, record.doc_id, record.path].filter(value => typeof value === "string");
}

export function mapRankedResults(candidates, catalog) {
  const entries = new Map();
  for (const entry of Array.isArray(catalog) ? catalog : []) {
    if (entry && typeof entry === "object" && isCatalogSkillPath(entry.path)
      && entry.id === entry.path && typeof entry.body === "string") {
      entries.set(entry.path, entry);
    }
  }

  const results = [];
  const seen = new Set();
  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    const relative = candidatePaths(candidate).find(value => isCatalogSkillPath(value) && entries.has(value));
    if (!relative || seen.has(relative)) continue;
    seen.add(relative);
    const entry = entries.get(relative);
    results.push({
      id: entry.id,
      name: entry.name,
      description: entry.description,
      license: entry.license,
      source: entry.source,
      sourceType: entry.sourceType,
      path: entry.path,
      excerpt: excerptFrom(entry.body),
      score: Number.isFinite(candidate.score) ? candidate.score : 0
    });
  }
  return results;
}

function respond(res, status, data) {
  res.statusCode = status; res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store"); res.end(JSON.stringify(data));
}

export function createApiHandler(options = {}) {
  const root = path.resolve(options.root ?? process.env.MEMBRICK_PROJECT_ROOT ?? defaultRoot);
  const provider = options.provider ?? process.env.MEMBRICK_PROVIDER ?? "codex";
  let memory = options.memory;
  let catalogPromise;
  return async function handleApi(req, res, next) {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/skills/search") return next?.();
    if (req.method !== "GET") return respond(res, 405, { error: "Use GET to search skills." });
    const query = (url.searchParams.get("q") ?? "").trim().slice(0, 160) || "skills";
    try {
      if (!memory) {
        const { Memory } = await import("membrick");
        memory = new Memory({ path: root });
      }
      catalogPromise ??= readFile(path.join(root, "site/public/catalog.json"), "utf8").then(JSON.parse);
      const [response, catalog] = await Promise.all([
        memory.workspaceSearch(query, provider, { workspace: root, topK: 60 }),
        catalogPromise
      ]);
      if (!response || !Array.isArray(response.results)) {
        return respond(res, 503, {
          error: "Membrick returned an invalid skills search response.",
          hint: "Showing local catalog search is available in the client."
        });
      }
      const candidates = response.results;
      const results = mapRankedResults(candidates, catalog);
      if (candidates.length > 0 && results.length === 0) {
        return respond(res, 503, {
          error: "Membrick returned no paths from the curated skills catalog.",
          hint: "Showing local catalog search is available in the client."
        });
      }
      respond(res, 200, { query, total: results.length, results });
    } catch (error) {
      respond(res, 503, {
        error: "Membrick could not search the skills index. Check the Membrick package, resident, and workspace index.",
        hint: "Check that this server can acquire a Membrick resident lease for MEMBRICK_PROJECT_ROOT and that the resident allows this workspace.",
        detail: error instanceof Error ? error.message.slice(-600) : undefined
      });
    }
  };
}
