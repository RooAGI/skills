---
name: web-research
description: Research public web pages with the RooAGI managed browser and, when available, an already-open signed-in native browser to find, compare, and verify facts, then report findings with source URLs.
license: MIT
tags: [research, web, browser, verification]
---

# Web Research

Use this skill for tasks that need current information from the web, such as
finding places, comparing options, or checking availability. RooAGI gives the
worker a host-owned managed browser. When the Desktop Computer Use host is
available, it can also reuse an already-open Safari, Chrome, Chrome Canary, or
Firefox window through permission-gated Computer Use.

## Tools

- Discover each browser tool with `desktop__tools_search`, inspect its schema
  with `desktop__tools_describe`, then call it with `desktop__tools_invoke` and
  the returned `toolId`. These permission-proxy calls are the supported route;
  browser tools are not exposed directly.
- `open(url)` opens a page. Every new site needs host approval; wait for the
  result and honor a denial.
- `read_page()` returns the current page title, URL, and visible text.
- `click_text(text)` follows a visible link or button on the current page.
- `fill_field(label, value)` fills one visible field by its exact accessible label
  or placeholder. It requests host permission and does not submit the form.

There is no search-engine API. Use Google Search by default unless the user
requests a different engine. Open a search URL such as
`https://www.google.com/search?q=<url-encoded-query>` in the managed browser.
Treat search results as discovery; open and read the source pages before relying
on claims.

## Existing signed-in browser

The managed browser has a separate session and may not be signed in. For sites
where the user's existing login or browser session matters, prefer Computer
Use over the managed browser. Use `desktop__tools_search` to find its
`list_windows` tool, then describe and invoke it through the permission proxy.
Select an already-open Safari, Chrome, Chrome Canary, or Firefox window,
preferably the user's default browser when identifiable. Do not launch the
browser or open a new window; the user may already be signed in there. Inspect
the selected window before interacting. If needed, navigate within it through
its address bar using host-approved Computer Use actions; generic desktop input
is not the browser-control path. Each inspection or action requires a separate
host approval, and browser navigation or submission may not be verifiable. Never
type passwords, one-time codes, or other credentials, and do not submit a form
unless the user specifically asked for that action. If no suitable browser
window is already open or approval is denied, report that as the blocker.

If a site shows a sign-in page in the managed browser, do not ask the user to
send credentials in chat and never enter credentials yourself. Leave the managed
browser open on that page, report that manual sign-in is needed, and mark the
task blocked so the Project orchestrator can ask the user to sign in there. Wait
for the user to confirm they are signed in before retrying the task. The managed
browser profile is retained for the project's FlowRun so the retry can use the
same session.

## Method

1. Break the request into the facts you must establish and the criteria each
   candidate must meet.
2. Prefer authoritative sources: official park, airport (for example AirNav or
   the airport's own site), rental-company, and lodging pages.
3. Read each page before relying on it. Record the URL and the exact fact it
   supports. Do not infer a fact from a search snippet alone when the source
   page can be opened.
4. Check every criterion for each candidate. Note which criteria are verified,
   which are estimated (for example flight time from distance and typical
   cruise speed), and which could not be checked.
5. Live inventory such as lodging availability changes and may require
   interactive booking forms. Use `fill_field` for visible labeled fields such
   as arrival and departure dates; use ISO dates (`YYYY-MM-DD`) for date inputs.
   Filling a field does not submit the form. Submit only through a separate
   host-approved click, then read the page again. Report what the pages show and
   when you checked; never claim a booking or availability you did not see.

## Report

List each candidate with the evidence and source URL per criterion, state any
assumptions, and name the blockers for anything you could not verify. End with
the worker status line the task requires.
