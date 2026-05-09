# 0041 - Input Robustness And Normalization Policy

## Status

Accepted

## Context

Inputs arrive through paste fields and URLs. Real data contains UTF-8 BOMs, CRLF line endings, NBSP, smart quotes, wrapped tokens, malformed CSV rows, and partial hashes.

## Decision

Normalize at the boundary:

- strip UTF-8 BOM
- normalize CRLF/CR to LF
- convert NBSP and narrow NBSP to regular spaces
- preserve user-facing Unicode text
- trim invite wrappers without altering cryptographic payload bytes after extraction
- parse CSV with Papa Parse, delimiter sniffing, and row-level errors
- treat partial/corrupt room hashes as recoverable input errors

## Consequences

The app becomes tolerant of common copy/paste damage without accepting ambiguous data silently.

## Alternatives Considered

Hand-written CSV parsing was rejected in favor of Papa Parse.
