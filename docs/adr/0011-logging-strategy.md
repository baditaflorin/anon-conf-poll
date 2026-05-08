# 0011 - Logging Strategy

## Status

Accepted

## Context

Mode A has no server logs. Browser logging must be helpful during development and quiet in production.

## Decision

Use a tiny logging wrapper that emits debug logs only in development. Production logs are limited to errors that help diagnose local failures without exposing credential material.

## Consequences

- No server-side telemetry exists.
- Console noise stays low for attendees.
- Error messages must be user-facing where recovery is possible.

## Alternatives Considered

- Full client log collector: rejected for privacy.
- Raw `console.log` throughout the app: rejected.
