/**
 * Parse room numbers from various formats:
 * - Single: "21"
 * - Comma separated: "21, 23, 24, 43"
 * - Space separated: "21 23 24 43"
 * - Newline separated
 * - Range: "101-105" -> 101, 102, 103, 104, 105
 * - Prefixed range: "R101-R105", "A1-A5"
 */
export function parseRoomTokens(input: string): string[] {
  if (!input || !input.trim()) return [];

  // Split on commas, newlines, semicolons
  const rawParts = input.split(/[\n,;]+/).map((p) => p.trim()).filter(Boolean);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const part of rawParts) {
    // Check for range like "101-105" or "A101-A105" or "101 - 105"
    const rangeMatch = part.match(/^([A-Za-z_-]*)(\d+)\s*[-~to]+\s*([A-Za-z_-]*)(\d+)$/i);
    if (rangeMatch) {
      const prefix1 = rangeMatch[1];
      const startNum = parseInt(rangeMatch[2], 10);
      const prefix2 = rangeMatch[3];
      const endNum = parseInt(rangeMatch[4], 10);
      const prefix = prefix1 || prefix2 || '';

      if (!isNaN(startNum) && !isNaN(endNum) && startNum <= endNum && (endNum - startNum) <= 100) {
        for (let i = startNum; i <= endNum; i++) {
          const room = `${prefix}${i}`;
          if (!seen.has(room.toLowerCase())) {
            seen.add(room.toLowerCase());
            result.push(room);
          }
        }
        continue;
      }
    }

    // Check for space-separated tokens e.g. "21 23 24 43"
    const spaceTokens = part.split(/\s+/).filter(Boolean);
    if (spaceTokens.length > 1 && spaceTokens.every((t) => /^[A-Za-z0-9_-]+$/.test(t))) {
      for (const tok of spaceTokens) {
        if (!seen.has(tok.toLowerCase())) {
          seen.add(tok.toLowerCase());
          result.push(tok);
        }
      }
      continue;
    }

    if (!seen.has(part.toLowerCase())) {
      seen.add(part.toLowerCase());
      result.push(part);
    }
  }

  return result;
}
