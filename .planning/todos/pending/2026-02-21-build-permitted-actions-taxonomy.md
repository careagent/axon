---
created: 2026-02-21T11:16:10.583Z
title: Build permitted actions taxonomy
area: general
files: []
---

## Problem

The CANS schema redesign introduces `scope.permitted_actions` as a whitelist-only model — if an action isn't listed, it's denied. These actions cannot be free-text strings typed by providers during onboarding. There must be a standardized, controlled vocabulary of clinical actions that every CareAgent installation speaks.

This taxonomy needs to:
- Be organized by provider type (across all 49 clinical worker categories)
- Serve as the registry of all valid action identifiers that populate `scope.permitted_actions` in CANS.md
- Be referenced by clinical skills when declaring what privileges they require
- Be presentable during onboarding so providers select from valid actions for their type
- Be maintainable by professional societies and licensing bodies who are domain experts for each provider type

Without this taxonomy, the whitelist-only scope model falls apart — there's no shared language between CANS documents, skills, and the hardening engine.

## Solution

Build a clinical action taxonomy registry on Axon that:
1. Defines a hierarchical action vocabulary (e.g., `chart.operative_note`, `order.medication`, `perform.craniotomy`)
2. Maps actions to provider types — which actions are relevant to which of the 49 categories
3. Exposes an API or data file that onboarding questionnaires and the provider-core plugin can query
4. Supports versioning so the taxonomy can evolve without breaking existing CANS documents
5. Eventually allows professional societies to maintain their own action subsets
