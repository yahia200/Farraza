# Use pragmatic-drag-and-drop for the pipeline board

Status: accepted

The candidate pipeline board needs drag-and-drop to move an Application between Stages. We chose Atlassian's `@atlaskit/pragmatic-drag-and-drop` (4.0.0) over `@dnd-kit/core` (6.3.1) and `@dnd-kit/react` (0.5.0).

Considered options:

- **`@dnd-kit/core` 6.3.1** — stable and popular with a built-in keyboard sensor, but no release since December 2024 and only implicit React 19 support (peer `react: ">=16.8.0"`).
- **`@dnd-kit/react` 0.5.0** — React-19-native but pre-1.0 with an unstable API, too risky for code we intend to keep.
- **`@atlaskit/pragmatic-drag-and-drop` 4.0.0** — framework-agnostic (no React peer dependency, so it won't rot against future React upgrades) and actively maintained.

We picked pragmatic-drag-and-drop for maintenance longevity and React-version independence. The cost: thinner documentation, and we write the React bindings and the drop indicator ourselves.

Consequences: drag is a progressive enhancement only. A "Move to stage" Select on each card and in the detail sheet remains the keyboard, touch, and mobile path (on mobile the board is stage tabs, where cross-column drag is not possible), so the board is fully usable without the drag wiring.
