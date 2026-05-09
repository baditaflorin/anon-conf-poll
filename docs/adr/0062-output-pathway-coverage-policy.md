# 0062 - Output Pathway Coverage Policy

## Status

Accepted.

## Context

v0.1.0/v0.2.0 can download result files, copy room URLs, and copy invite codes. Users also need copyable output and a full state artifact they can import later.

## Decision

Support these output paths:

- copy room URL
- copy active invite
- download invite roster JSON
- download results JSON with provenance
- download vote CSV
- copy results JSON and vote CSV
- download and copy full state JSON
- print a simple report through browser print

Unsupported paths are screenshot export, embed code, and API/curl output.

## Consequences

The CSV label must be honest: it is a vote CSV, not a complete results artifact. The JSON/state schemas are versioned and validated on import.

## Alternatives Considered

Adding a hosted API export was rejected because the deployment mode is static.
