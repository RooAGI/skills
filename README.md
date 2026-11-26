# RooAGI skills

Skills are instructions an agent loads when a task needs them: how to debug,
how to review a pull request, how to use a tool. Each skill is a folder with a
`SKILL.md` whose frontmatter has a `name`, a `description` and a `license`.
RooAGI Desktop gives its workers the skills from this repository.

## Layout

| Folder | What it holds |
| --- | --- |
| `rooagi/` | Skills RooAGI writes, under the MIT license in `LICENSE`. |
| `vendor/<source>/` | Skills copied from other public repositories, each under its own license (see `ATTRIBUTION.md` in each source folder). Do not edit these by hand. |
| `upstream/<source>/` | Pinned Git submodules. Catalog roots in `sources.json` bound discovery to these repositories; every `SKILL.md` beneath each root is cataloged. |
| `notes/<source>/<skill>.md` | RooAGI-specific notes appended to a vendored skill when it is synced, for example how to reach GitHub without network access in commands. |
| `sources.json` | Which upstream skills are vendored, each source pinned to a commit. |
| `scripts/sync.mjs` | Copies the listed skills into `vendor/` and checks every skill. |

## Upstream sources

| Source | Repository | License |
| --- | --- | --- |
| `hermes` | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | MIT |
| `anthropic` | [anthropics/skills](https://github.com/anthropics/skills), pinned at `upstream/anthropic-skills` | 18 selected skills verified as Apache-2.0; catalog scans all skills and records available license evidence |
| `aws-agent-toolkit` | [aws/agent-toolkit-for-aws](https://github.com/aws/agent-toolkit-for-aws), pinned at `upstream/aws-agent-toolkit` | Apache-2.0 (root LICENSE and NOTICE) |
| `cloudflare` | [cloudflare/skills](https://github.com/cloudflare/skills), pinned at `upstream/cloudflare-skills` | Apache-2.0 (root LICENSE) |
| `Alireza Rezvani / claude-skills` | [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills), pinned at `upstream/claude-skills` | MIT (root LICENSE); catalog scans every repository `SKILL.md` |

For AWS, the catalog selects all 133 skills under upstream `skills/`. The 91
skill files bundled inside plugin directories are excluded because they mirror
skills already listed in `skills/`; plugin metadata and configuration are not
agent skills and are not cataloged. For Cloudflare, it selects all 24 documented
skills under `skills/`; plugin metadata, rules, and MCP configuration are not
agent skills and are not cataloged. No skill candidates were excluded from the
Cloudflare `skills/` directory because the repository's root Apache-2.0 license
covers that tree.
| `openai` | [openai/skills](https://github.com/openai/skills) | Apache-2.0 (per skill) |
| `superpowers` | [obra/superpowers](https://github.com/obra/superpowers) | MIT |
| `addyosmani` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | MIT |

Catalog discovery scans every `SKILL.md` below each configured `catalogRoot`, at
the pinned repository revision. These roots keep discovery bounded; paths outside
them are excluded. The `skills` selections still control what sync copies or
validates, but do not filter catalog entries. The Alireza repository uses `.` as
its root, so every skill across the pinned repository is discovered; non-SKILL
documents remain outside the catalog. Missing per-skill license files do not hide
a skill: each entry carries available per-skill or root license text, upstream
notices, attribution, and a license status. Identical copies at distinct paths
remain separate entries. Catalog generation reports raw candidate, included-entry,
duplicate-path, and duplicate-content counts by source and in total.

## Working with it

```sh
node scripts/sync.mjs             # sync copied sources; validate pinned submodule skills in place
node scripts/sync.mjs --check     # fail if vendor/ is out of date; validate every skill
node scripts/sync.mjs --validate  # only validate the skills already here
node scripts/sync.mjs --latest    # move every source to its newest commit, then sync (needs gh)
```

To add a copied upstream skill, add its path to the source's `skills` in
`sources.json`, run `node scripts/sync.mjs`, read what it copied, and open a pull
request. For submodule sources, add a path only after checking its license evidence and notice at the pinned revision. Sources may provide per-skill licenses or a repository-level license covering the selected tree. Advance a submodule only
in a reviewed pull request: fetch and inspect the proposed upstream commit,
update the gitlink, regenerate the catalog, and review both the gitlink and
catalog diffs. The scheduled vendor sync does not advance submodule pins. To
add a RooAGI skill, create `rooagi/<name>/SKILL.md`.

A skill is instructions a model follows with real tools, so every change,
including an upstream update, is reviewed in a pull request before it ships.
A weekly workflow opens that pull request when an upstream source has moved.

## License

MIT for RooAGI's own skills and the tooling (`LICENSE`). Vendored skills keep
their upstream licenses.
