# 0042 - Inference Engine

## Status

Accepted

## Context

The highest-value Phase 2 gaps are roster and poll draft ingestion. Users should see a useful first guess before configuring anything.

## Decision

Add deterministic browser-side inference modules:

- roster inference for Eventbrite-like, Zoom-like, and generic attendee CSVs
- poll inference for prose/bullets and CSV/TSV rows
- field role classification for email, name, status, ticket, poll id, title, and option
- stable IDs from normalized text slugs plus deterministic collision suffixes

Inference returns preview objects, confidence, anomalies, suggested fixes, and source metadata.

## Consequences

Room creation can use inferred attendee count and inferred polls while preserving the existing static architecture.

## Alternatives Considered

LLM/server inference was rejected because Mode A must remain static and deterministic.
