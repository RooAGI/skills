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
| `notes/<source>/<skill>.md` | RooAGI-specific notes appended to a vendored skill when it is synced, for example how to reach GitHub without network access in commands. |
| `sources.json` | Which upstream skills are vendored, each source pinned to a commit. |
| `scripts/sync.mjs` | Copies the listed skills into `vendor/` and checks every skill. |

## Upstream sources

| Source | Repository | License |
| --- | --- | --- |
| `hermes` | [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) | MIT |
| `anthropic` | [anthropics/skills](https://github.com/anthropics/skills) | Apache-2.0 (per skill) |
| `openai` | [openai/skills](https://github.com/openai/skills) | Apache-2.0 (per skill) |
| `superpowers` | [obra/superpowers](https://github.com/obra/superpowers) | MIT |
| `addyosmani` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | MIT |

Only permissive licenses are accepted (MIT, Apache-2.0, BSD, ISC). Several
upstream repositories license each skill separately, and some of their skills
are not open source: list only skills whose own license is permissive.

## Working with it

```sh
node scripts/sync.mjs             # copy the skills listed in sources.json into vendor/
node scripts/sync.mjs --check     # fail if vendor/ is out of date; validate every skill
node scripts/sync.mjs --validate  # only validate the skills already here
node scripts/sync.mjs --latest    # move every source to its newest commit, then sync (needs gh)
```

To add an upstream skill, add its path to the source's `skills` in
`sources.json` (or add a source with its repository, a full commit SHA and its
license), run `node scripts/sync.mjs`, read what it copied, and open a pull
request. To add a RooAGI skill, create `rooagi/<name>/SKILL.md`.

A skill is instructions a model follows with real tools, so every change,
including an upstream update, is reviewed in a pull request before it ships.
A weekly workflow opens that pull request when an upstream source has moved.

## License

MIT for RooAGI's own skills and the tooling (`LICENSE`). Vendored skills keep
their upstream licenses.
