#!/bin/bash
# Validate Version const matches service.yaml

REPO_DIR="${1:-.}"

# Read service.yaml version
if [ ! -f "$REPO_DIR/service.yaml" ]; then
  exit 0
fi

SERVICE_VERSION=$(grep -E '^\s*version:' "$REPO_DIR/service.yaml" | head -1 | sed "s/.*version:[[:space:]]*[\"']\?\([^\"']*\).*/\1/")

if [ -z "$SERVICE_VERSION" ]; then
  exit 0
fi

# Check main.go
if [ ! -f "$REPO_DIR/main.go" ]; then
  exit 0
fi

CONST_VERSION=$(grep -E 'const\s+Version\s*=\s*"[^"]*"' "$REPO_DIR/main.go" | head -1 | sed 's/.*"\([^"]*\)".*/\1/')

if [ -z "$CONST_VERSION" ]; then
  exit 0
fi

# Compare
if [ "$SERVICE_VERSION" != "$CONST_VERSION" ]; then
  echo "ERROR: Version drift in $REPO_DIR"
  echo "  service.yaml: $SERVICE_VERSION"
  echo "  main.go const: $CONST_VERSION"
  exit 1
fi

exit 0
