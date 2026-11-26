import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const siteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(siteRoot, "..");
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(file);
    else if (entry.isFile() && entry.name === "SKILL.md") files.push(file);
  }
}
async function readOptional(file) {
  try { return (await readFile(file, "utf8")).trim(); }
  catch (error) { if (error.code === "ENOENT") return undefined; throw error; }
}
function parse(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  const fields = {};
  if (!match) return fields;
  const lines = match[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const field = lines[i].match(/^([\w-]+):\s*(.*)$/);
    if (!field) continue;
    let value = field[2].trim();
    if (value === ">" || value === "|") {
      const parts = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) parts.push(lines[++i].trim());
      value = parts.join(" ");
    }
    fields[field[1]] = value.replace(/^['"]|['"]$/g, "");
  }
  return fields;
}
const manifest = JSON.parse(await readFile(path.join(repoRoot, "sources.json"), "utf8"));
const sources = manifest.sources;
const submodules = new Map();
for (const [name, config] of Object.entries(sources)) {
  if (!config.submodule || !config.catalogRoot) continue;
  const root = path.join(repoRoot, config.submodule);
  const actual = execFileSync("git", ["-C", root, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (actual !== config.commit) throw new Error(name + " submodule pin mismatch: expected " + config.commit + ", got " + actual);
  const rootLicense = config.licenseFile && !config.licenseFile.startsWith("per-skill:")
    ? await readOptional(path.join(root, config.licenseFile)) : undefined;
  const upstreamNotice = config.noticeFile ? await readOptional(path.join(root, config.noticeFile)) : undefined;
  const source = { name, config, root, rootLicense, upstreamNotice };
  submodules.set(name, source);
  await walk(config.catalogRoot === "." ? root : path.join(root, config.catalogRoot));
}
for (const directory of ["rooagi", "vendor"]) await walk(path.join(repoRoot, directory));
const rootLicenseNotice = (await readFile(path.join(repoRoot, "LICENSE"), "utf8")).trim();
const catalog = [];
const sourceCounts = new Map();
const seenPaths = new Set();
const seenContent = new Set();
let totalDuplicatePaths = 0;
for (const file of files.sort()) {
  const relative = path.relative(repoRoot, file).split(path.sep).join("/");
  const sourceInfo = [...submodules.values()].find(({ config }) => relative.startsWith(config.submodule + "/"));
  const sourceKey = sourceInfo?.name ?? (relative.startsWith("rooagi/") ? "RooAGI" : relative.split("/")[1]);
  const source = sourceInfo?.config.catalogName ?? sourceKey;
  const stats = sourceCounts.get(source) ?? { rawCandidates: 0, includedEntries: 0, duplicatePaths: 0, duplicateContentCopies: 0 };
  stats.rawCandidates++;
  if (seenPaths.has(relative)) { stats.duplicatePaths++; totalDuplicatePaths++; sourceCounts.set(source, stats); continue; }
  seenPaths.add(relative);
  const markdown = await readFile(file, "utf8");
  const metadata = parse(markdown);
  if (!metadata.name || !metadata.description) throw new Error("Missing name or description in " + relative);
  const local = relative.startsWith("rooagi/");
  const skillPath = sourceInfo ? path.dirname(relative.slice((sourceInfo.config.submodule + "/").length)) : null;
  const perSkillFile = sourceInfo?.config.licenseFile?.startsWith("per-skill:") ? sourceInfo.config.licenseFile.slice("per-skill:".length) : undefined;
  const perSkillLicense = perSkillFile ? await readOptional(path.join(sourceInfo.root, skillPath, perSkillFile)) : undefined;
  const licenseNotice = perSkillLicense ?? sourceInfo?.rootLicense;
  const licenseStatus = perSkillLicense ? "per-skill" : licenseNotice ? "root" : metadata.license ? "frontmatter" : "not-found";
  const contentId = createHash("sha256").update(markdown).digest("hex");
  if (seenContent.has(contentId)) stats.duplicateContentCopies++;
  seenContent.add(contentId);
  const entry = {
    id: relative, name: metadata.name, description: metadata.description,
    license: sourceInfo ? sourceInfo.config.license : metadata.license || "License not specified",
    licenseStatus, source, sourceType: local ? "RooAGI" : "Community",
    sourceUrl: sourceInfo
      ? "https://github.com/" + sourceInfo.config.repo + "/tree/" + sourceInfo.config.commit + "/" + skillPath
      : local ? "https://github.com/RooAGI/skills/blob/main/" + relative
        : sources[sourceKey] ? "https://github.com/" + sources[sourceKey].repo + "/tree/" + sources[sourceKey].commit : "https://github.com/RooAGI/skills",
    path: relative, body: markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").trim(), rootLicenseNotice
  };
  if (sourceInfo) {
    const copyright = sourceInfo.rootLicense?.match(/^Copyright[^\n]*/im)?.[0];
    entry.attribution = { ...(copyright ? { copyright } : {}), repository: "https://github.com/" + sourceInfo.config.repo, commit: sourceInfo.config.commit, path: skillPath };
    entry.licenseNotice = licenseNotice;
    if (sourceInfo.upstreamNotice) entry.upstreamNotice = sourceInfo.upstreamNotice;
  }
  catalog.push(entry);
  stats.includedEntries++;
  sourceCounts.set(source, stats);
}
const output = path.join(siteRoot, "public", "catalog.json");
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(catalog));
const totals = { rawCandidates: 0, includedEntries: 0, duplicatePaths: 0, duplicateContentCopies: 0 };
for (const [source, counts] of [...sourceCounts].sort(([a], [b]) => a.localeCompare(b))) {
  console.log(source + ": raw candidates " + counts.rawCandidates + ", included entries " + counts.includedEntries + ", duplicate paths " + counts.duplicatePaths + ", duplicate-content copies " + counts.duplicateContentCopies);
  for (const key of Object.keys(totals)) totals[key] += counts[key];
}
totals.duplicatePaths = totalDuplicatePaths;
console.log("Total: raw candidates " + totals.rawCandidates + ", included entries " + totals.includedEntries + ", duplicate paths " + totals.duplicatePaths + ", duplicate-content copies " + totals.duplicateContentCopies);
console.log("Generated " + catalog.length + " skills in " + path.relative(repoRoot, output));
