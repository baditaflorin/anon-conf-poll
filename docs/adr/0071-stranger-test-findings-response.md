# 0071 - Stranger-Test Findings and Response

## Status

Accepted.

## Context

Phase 3 requires testing the app as if a stranger arrived cold with real data.

## Decision

Use a private-browser workflow with a fresh generated room, Eventbrite-style roster file, poll draft file, copied invite text, state export/import, and reset. The top three expected failure modes from the audit are:

1. "Where do I upload my file?"
2. "Can I save this and come back later?"
3. "How do I start over?"

Phase 3 will fix those directly with import/drop controls, state export/import/autosave, and start-fresh reset.

## Consequences

The stranger test becomes a documented post-implementation check, not just a subjective claim.

## Alternatives Considered

Waiting for a separate human test pass was not feasible in this autonomous run; the private-browser substitute is documented honestly.
