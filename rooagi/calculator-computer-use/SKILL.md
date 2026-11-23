---
name: calculator-computer-use
description: Use macOS Calculator through RooAGI Computer Use for arithmetic, fresh AX inspection, safe input, Clear handling, and displayed-result verification.
license: MIT
tags: [calculator, arithmetic, computer-use, accessibility, macos]
---

# Calculator Computer Use

Use this skill only for requests that require operating the supported macOS
Calculator with Computer Use tools available in the current run. RooAGI uses
the host-owned Computer Use interface; do not invent action names from other agents or
call the Cua Driver directly.

Also apply `macos-accessibility-computer-use` for the shared target, permission,
approval, and accessibility-observation rules when that skill is available.

## RooAGI tool map

- `list_apps` discovers installed/running apps. It does not establish a window
  target for later actions.
- `list_windows` returns host-verified windows and run-scoped `targetId`
  values. Use the target whose app ID is `com.apple.calculator`.
- `inspect_window(targetId)` returns the current accessibility observation
  without requesting a screenshot. Use it to read the Calculator display,
  labels, roles, enabled states, and element tokens.
- `capture_window(targetId)` returns the accessibility observation with a
  screenshot. Use it when the tree is ambiguous or a visual cross-check helps.
- `press_key(targetId, key)` sends one permitted arithmetic key. Use one
  character per call and no modifiers.
- `click_element(targetId, elementToken)` or
  `click_element(targetId, elementLabel)` activates one inspected safe
  Calculator control. Labels must be exact and unique in the fresh tree.

The host issues target IDs for the current Computer Use run. Never make one up,
reuse one from a different run, or substitute the bundle ID as `targetId`.

## Inspect, act, verify

1. Call `list_windows` and select the host-issued Calculator target. If the app
   is absent, stop; this skill does not provide an app-launch tool.
2. Call `inspect_window` on that target before reading the display or choosing
   a control. Treat each observation as a snapshot. Labels and element tokens
   can change when the display changes.
3. For arithmetic, send the expression as separate `press_key` calls: one
   digit or operator at a time, with no modifiers. Use the supported operator
   character (`+`, `-`, `*`, `/`, `%`, `.` or `=`); do not send words such as
   `Add`, `plus`, `Return`, or `Clear` as key names.
4. Wait for each action result before issuing the next key. Do not group a
   whole expression into one action.
5. After entering the expression, inspect the same target again. Confirm the
   visible expression and result before reporting completion.
6. If an action reports a stale target or element, refresh `list_windows` or
   `inspect_window` as indicated and use the new target/token. Never retry the
   rejected input using a cached token.

## Clearing the display

Always clear before entering a new expression unless the fresh inspection shows
the display is exactly `0`. Keys append to whatever is already shown, so a
leftover `1` followed by `3` produces `13`, not `3`. The display value may begin
with an invisible direction mark (U+200E); ignore it when reading digits.

On current macOS, Calculator exposes keypad buttons by identifier, so the
control labels are words such as `Clear`, `Delete`, `Add`, `Equals`, and
`Seven`. `Clear` resets the display; `Delete` only removes the last digit.

1. Inspect the current Calculator tree and find the enabled `Clear`, `All
Clear`, `AC`, or `C` control that is actually shown.
2. Use `click_element` with its exact unique visible label, or its token from
   the latest inspection. RooAGI refreshes Calculator controls before a click
   and rejects ambiguous, missing, disabled, or unsafe controls.
3. Wait for the click result, inspect again, and confirm the display is clear
   before entering a new expression.

Do not click number or operator buttons as the normal input path. A state
change can invalidate their accessibility tokens; individual key presses are
more reliable. Use an accessibility click for Clear only when the fresh tree
shows a safe, unique control.

## Accessibility and screenshots

There is no fixed Calculator accessibility tree to memorize. Use the live tree
for the current macOS version and Calculator state. The tree may expose the
display as an edit field and controls as native buttons; labels and control
availability can vary. Do not assume a button exists because it appeared in an
earlier run.

`inspect_window` is the accessibility-only path. `capture_window` adds a
screenshot while retaining the accessibility observation. If the tree is
empty or degraded, do not infer button labels or a displayed result from the
screenshot alone. The host allows only a narrow set of unmodified arithmetic
keys on the verified Calculator window; use them only when the requested
operation is clear, then verify with a fresh inspection. Stop if the result
cannot be read.

## Permissions and coordination

Computer Use requests are subject to RooAGI's configured approval policy.
Wait for each approval/action result and honor denial or cancellation. Do not
claim that access is unrestricted merely because a permission setting appears
enabled. The host checks macOS Accessibility and Screen Recording state.

Only one task should operate a given Calculator window at a time. If the host
reports that another task owns it, wait for that operation to finish; do not
start a parallel Calculator task or send overlapping keys.

## Report

Report the result only after a fresh accessibility inspection shows it.
If any action fails or the display cannot be verified, state the last
observed display and the specific blocker. Do not claim the arithmetic was
completed based only on the key actions being accepted.
