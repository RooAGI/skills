## RooAGI notes

In RooAGI, `run_command` has no network access, so `gh` and `git push` cannot
reach GitHub from a worker's commands. Use the GitHub connector's tools
instead: find them with `desktop__tools_search` ("github"), read their input
with `desktop__tools_describe`, and call them with `desktop__tools_invoke`.
Local `git` commands that only read the repository work in `run_command`;
ones that change it need `writable: [".git"]`.
