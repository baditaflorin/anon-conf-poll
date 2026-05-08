# 0008 - Go Backend Project Layout

## Status

Accepted

## Context

The bootstrap asks for Go layout in Modes B/C. ADR 0001 chooses Mode A.

## Decision

Do not create a Go backend layout in v1.

## Consequences

- No `cmd/`, `internal/`, or Docker backend files are present.
- The repository remains focused on the static frontend.
- A future Mode B/C ADR must introduce the Go layout before backend code.

## Alternatives Considered

- Empty Go directories: rejected because they imply an unused backend surface.
