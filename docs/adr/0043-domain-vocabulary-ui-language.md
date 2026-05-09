# 0043 - Domain Vocabulary And UI Language

## Status

Accepted

## Context

Existing errors expose implementation terms like compressed JSON and schema parsing. Organizers think in rosters, invites, room links, polls, and counted votes.

## Decision

Use domain vocabulary:

- roster row, eligible attendee, duplicate attendee, excluded attendee
- invite code, room link, poll draft, poll option
- counted vote, duplicate vote, pending verification, rejected proof

Errors must say what failed, why it matters, and what the user can do next.

## Consequences

The UI becomes more honest and supportable without adding visual polish.

## Alternatives Considered

Passing raw schema errors through was rejected.
