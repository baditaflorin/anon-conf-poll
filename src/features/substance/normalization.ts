export function normalizeTextInput(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

export function stableChecksum(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function slugifyStable(value: string, fallback = "item"): string {
  const slug = normalizeTextInput(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);

  return slug || fallback;
}

export function uniqueStableId(base: string, seen: Set<string>): string {
  let candidate = base;
  let suffix = 2;

  while (seen.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  seen.add(candidate);
  return candidate;
}
