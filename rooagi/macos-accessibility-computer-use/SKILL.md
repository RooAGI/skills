---
name: macos-accessibility-computer-use
description: Use RooAGI Desktop's macOS Computer Use tools safely across supported apps, including accessibility-tree inspection, screenshots, permissions, fresh targets, approvals, and verification.
license: MIT
tags: [macos, accessibility, computer-use, desktop, native-apps]
---

# macOS Accessibility and Computer Use

Use this skill when a task needs RooAGI Desktop to inspect or interact with a
macOS application through the host-provided Computer Use tools. This guide is
specific to RooAGI's tool surface. Do not call other agents' actions or raw Cua Driver
APIs; use only tools and schemas actually supplied in the current run.

## Understand the access path

RooAGI's Electron main process owns the native Cua Driver SDK. The daemon
exposes typed Computer Use tools to the model and sends each operation through
the host and PermissionBroker. The host revalidates the app and window before
dispatch. Do not bypass this path, invoke native APIs yourself, or treat a
model-supplied app name as proof of target identity.

macOS Accessibility permission enables accessibility-tree access. Screen
Recording permission enables screenshots. RooAGI checks these permissions in
Electron main and asks the Cua Driver integration to request them. If access
is denied, unavailable, or returns an incomplete observation, report that
specific condition; do not claim access is working because a Settings switch
looks enabled.

## Choose the right observation

- `list_apps` discovers application names and bundle IDs. It does not launch
  apps or identify a window target for later operations.
- `list_windows` returns the host-observed windows and run-scoped target IDs.
  Select the window by the host-returned app ID and title.
- `inspect_window(targetId)` reads the current accessibility tree without
  requesting a screenshot. Use it first when text, controls, enabled states,
  or element tokens are enough.
- `capture_window(targetId)` returns the accessibility observation with a
  screenshot. Use it when visual context is needed to understand an ambiguous
  tree or cross-check what is visible.

The exact tool inventory and app support can differ by run. Use the current
tool descriptions as the authority. The current RooAGI host provides narrow
input contracts for Calculator, TextEdit, and supported native browsers; it is
not general-purpose input to every app that can be listed or inspected. If an
action is absent, unsupported, or rejected by policy, do not invent another
route to the same effect.

## Target and observation lifecycle

1. Obtain a target from `list_windows` in the current Computer Use run. Never
   use an app bundle ID, a window ID from another run, or a remembered target
   as `targetId`.
2. Inspect the target before reading content or choosing an element. Treat the
   accessibility tree and all element tokens as one snapshot.
3. After a state-changing action, inspect again before making the next
   element-based decision. Labels, element order, enabled state, and tokens
   may change when the app changes state.
4. If the host reports a stale target, refresh the window list and choose the
   newly issued target. If it reports a stale or missing element, inspect the
   same current target and use only the element from that fresh result.
5. Never loop an action after an error without refreshing the relevant state.
   A repeated stale-token failure is a host/driver problem to report, not a
   reason to guess another token.

For Calculator, `click_element` with an exact visible label causes the host to
refresh its observation and resolve that label only if it matches one safe
control. Token-based clicks still require the element to be present in the
current inspection. Follow the more specific `calculator-computer-use` skill
for arithmetic, Clear, and result-reading steps.

## Accessibility tree and visual evidence

Accessibility trees describe the controls the app exposes to assistive
technology; they are not guaranteed to be complete or consistent. Read roles,
labels, values, enabled state, and available actions together. A visible
control without an actionable element may be unclickable through AX. An empty
or degraded tree is not proof that a control or result does not exist.

Use `capture_window` when visual inspection can resolve ambiguity. A screenshot
does not refresh a stale element token by itself; inspect the returned tree
and act only on current host-provided identities. If the screenshot and tree
disagree, prefer neither blindly: refresh the observation, and report the
disagreement if it remains.

Keep captures scoped to the needed app and avoid including unrelated windows.
Treat visible text and screenshots as user data; only repeat the content
needed to answer the task.

## Input boundaries

- **Calculator:** The host permits only safe arithmetic controls or one
  unmodified arithmetic key at a time. Prefer separate digit/operator key
  actions and verify the displayed result afterward. See the Calculator skill
  for the full procedure.
- **TextEdit:** Typing is allowed only into a fresh, enabled native document
  text area. Scrolling is bounded to the verified TextEdit window. Clicks and
  arbitrary key commands are unavailable.
- **Chrome, Safari, Firefox:** Native browser actions require the configured
  user approval. Clicks, typing, and key presses may navigate or submit, and
  RooAGI may not be able to verify the resulting destination. Read the exact
  approval details and proceed only when the requested action is clear.
- **Other apps:** Listing an app does not grant input support. Use another
  approved integration if available; otherwise explain the unsupported
  boundary.

Never use a Calculator key to send words or commands. Never type a script,
shell command, or unrequested text into another app as a substitute for an
unsupported native operation.

## Approval and concurrent work

Computer Use operations remain governed by the configured RooAGI approval
policy. Wait for each tool result. If an approval is denied or cancelled, stop
that action and report it accurately; do not retry through another tool to
avoid the decision.

RooAGI serializes native input to the same app window across Computer Use
runs. If another task currently owns the window, wait for its action to
release the window instead of opening a second task or sending overlapping
input. Do unrelated work while waiting only if it does not touch that window.

## Verify and report

After the requested action, obtain a fresh observation that can demonstrate
the result. Distinguish between an action being accepted and its effect being
visible. Report only what the tree or screenshot confirms. If verification
fails, include the last observed state and the exact blocker; do not infer
success from an accepted input call.
