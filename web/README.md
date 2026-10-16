# ProLance UI/UX Context Update Pack

This pack updates the Markdown context for a role-aware, page-by-page UI redesign of the existing ProLance V1 frontend.

## What's included

- `Architecture.md` — cleaned, updated frontend source-of-truth index, links to all design/implementation context, and explicit notes about known documentation conflicts.
- `Project_breakdown.md` — cleaned version of the supplied “ProLance web — page breakdown (V1)” file, with visual-design authority and a separate UI redesign order appended. The original feature implementation order remains distinct from the redesign sequence.
- `docs/01-principles.md` — original architecture principles retained, plus role-aware UI principles and an auth-conflict warning.
- `docs/02-folder-structure.md` — original structure retained, plus guidance for placing UI components and preserving the one-shell architecture.
- `docs/03-data-layer.md` — original data-layer content retained, plus guardrails against mock data/API/cache/auth changes in visual batches.
- `docs/04-route-map.md` — original route rules retained, plus role-aware composition notes and explicit route discrepancies to verify.
- `docs/05-entity-types.md` — original entity definitions retained, plus display constraints grounded in available fields.
- `docs/06-role-aware-ui-ux-guide.md` — new product-specific visual source of guidance and route-by-route design direction.
- `docs/07-ui-redesign-execution-plan.md` — new audit-first workflow, recommended page batches, and reusable prompts.
- `docs/08-ui-redesign-progress.md` — new tracker to keep separate coding sessions aligned.
- `AI_AGENT_UI_REDESIGN_PROMPT.md` — one initial prompt to paste into the coding agent.

## Important scope note

The uploaded page-breakdown file and five files in `docs_.zip`, plus the `Architecture.md` text pasted into the conversation, were available for this update. The separate top-level `../PROJECT_BREAKDOWN.md` (backend/API build order) and `Freelancer_Marketplace_Functional_Requirements.md` were referenced by links but **were not supplied as files in this upload**. This pack therefore does not pretend to update either unseen document. Keep those existing project files unchanged and use them as the documentation hierarchy already describes.

## Install into the repository

Copy these files into your existing frontend project, replacing the matching files only after you review their diffs:

```text
<frontend-root>/
├── Architecture.md                         # replace/update existing
├── Project_breakdown.md                    # replace/update the supplied frontend page breakdown
├── AI_AGENT_UI_REDESIGN_PROMPT.md          # new
└── docs/
    ├── 01-principles.md                    # replace/update
    ├── 02-folder-structure.md               # replace/update
    ├── 03-data-layer.md                    # replace/update
    ├── 04-route-map.md                     # replace/update
    ├── 05-entity-types.md                  # replace/update
    ├── 06-role-aware-ui-ux-guide.md         # new
    ├── 07-ui-redesign-execution-plan.md     # new
    └── 08-ui-redesign-progress.md          # new
```

`Architecture.md` and `Project_breakdown.md` link each other using root-relative Markdown paths, so put them at the same level. Keep the five existing modular docs in the existing `docs/` directory. The archive preserves this target structure.

## Recommended process

1. Review the changed documentation, then copy the updated files into the repository.
2. Give the agent `AI_AGENT_UI_REDESIGN_PROMPT.md` as its initial instruction.
3. Make the agent complete **Phase 0 — read-only audit** and stop without changing code.
4. Review the report and then request one batch at a time, for example: “Implement Batch 2 — Role dashboards only.”
5. Require it to update `docs/08-ui-redesign-progress.md`, run relevant checks, and report the exact files changed after every batch.
6. Inspect and approve the result before moving on.

## Why this is safer than asking for a global redesign

The detailed UI direction lives in one source file (`docs/06-role-aware-ui-ux-guide.md`) rather than being copied in full across every document. The other files link to or add only the constraints relevant to their purpose. This reduces contradictions and token cost. The execution plan separates the read-only audit from implementation and keeps each code change reviewable.

