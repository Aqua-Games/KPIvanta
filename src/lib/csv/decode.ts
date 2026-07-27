/**
 * Decoding layer. Real exports are not always UTF-8 comma-separated:
 * the AdMob report in this project is UTF-16LE with a BOM and tab separators.
 */

export interface DecodeResult {
  text: string;
  encoding: string;
}

export function decodeBuffer(buffer: ArrayBuffer): DecodeResult {
  const bytes = new Uint8Array(buffer);

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: new TextDecoder("utf-16le").decode(bytes.subarray(2)), encoding: "UTF-16LE" };
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: new TextDecoder("utf-16be").decode(bytes.subarray(2)), encoding: "UTF-16BE" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder("utf-8").decode(bytes.subarray(3)), encoding: "UTF-8 (BOM)" };
  }

  // No BOM: UTF-16LE without a BOM still shows a NUL in every second byte.
  const sample = bytes.subarray(0, Math.min(bytes.length, 512));
  let nulEven = 0;
  let nulOdd = 0;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] !== 0) continue;
    if (i % 2 === 0) nulEven++;
    else nulOdd++;
  }
  if (nulOdd > sample.length / 4) {
    return { text: new TextDecoder("utf-16le").decode(bytes), encoding: "UTF-16LE" };
  }
  if (nulEven > sample.length / 4) {
    return { text: new TextDecoder("utf-16be").decode(bytes), encoding: "UTF-16BE" };
  }

  return { text: new TextDecoder("utf-8").decode(bytes), encoding: "UTF-8" };
}

const CANDIDATE_DELIMITERS = ["\t", ",", ";", "|"];

/** Picks the delimiter that splits the most lines into a consistent column count. */
export function detectDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .slice(0, 12);
  if (lines.length === 0) return ",";

  let best = ",";
  let bestScore = -1;

  for (const delimiter of CANDIDATE_DELIMITERS) {
    const counts = lines.map((line) => splitRespectingQuotes(line, delimiter).length);
    const max = Math.max(...counts);
    if (max < 2) continue;
    const modeCount = counts.filter((c) => c === max).length;
    const score = max * 2 + modeCount;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

export function splitRespectingQuotes(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === delimiter && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells;
}

/** Stable content fingerprint used to reject duplicate uploads. */
export function hashContent(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0")
  );
}
