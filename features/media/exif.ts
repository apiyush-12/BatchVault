/**
 * JPEG EXIF `APP1` segment removal — the server-side half of the B1
 * decision (security.md §27): GPS/location metadata must not silently
 * leave a member's photo and reach 120 classmates. Deliberately NOT a
 * third-party dependency: this is a narrow, auditable, segment-level
 * operation on the JPEG marker stream — it never decodes or re-encodes
 * the image, so pixel data is byte-for-byte untouched (no quality loss),
 * and it is small enough to review as application code rather than trust
 * to an unaudited package (rules.md §3's dependency-restraint argument).
 *
 * Scope, stated honestly: JPEG only. `image/png`, `image/webp`, and
 * `image/gif` pass through this module unmodified — a named, accepted
 * residual gap (security.md §27 B1), not a silent omission.
 *
 * Fails safe: any JPEG structure this parser does not confidently
 * recognize is returned UNMODIFIED, never partially rewritten. A
 * malformed/unusual file keeps its original EXIF (a narrow, accepted
 * limitation) rather than risking a corrupted image.
 */

const SOI = 0xd8;
const SOS = 0xda;
const EOI = 0xd9;
// Standalone markers carry no length-prefixed payload at all.
const STANDALONE_MARKERS = new Set([0x01, EOI, ...Array.from({ length: 8 }, (_, i) => 0xd0 + i)]);
const EXIF_IDENTIFIER = Buffer.from("Exif\0\0", "latin1");

export function stripJpegExif(input: Buffer): Buffer {
  if (input.length < 4 || input[0] !== 0xff || input[1] !== SOI) {
    return input; // Not a JPEG (no SOI) — nothing this module handles.
  }

  const segments: Buffer[] = [input.subarray(0, 2)];
  let offset = 2;

  while (offset + 1 < input.length) {
    if (input[offset] !== 0xff) {
      // Not at a marker boundary — an assumption this parser relies on
      // broke. Bail out safely rather than risk corrupting the file.
      return input;
    }

    const marker = input[offset + 1];
    if (marker === undefined) {
      return input; // Should be unreachable given the loop guard above.
    }

    if (marker === SOS) {
      // Start of Scan: everything from here to EOI is compressed image
      // data with no further length-prefixed markers to parse. Copy the
      // rest verbatim and stop.
      segments.push(input.subarray(offset));
      return Buffer.concat(segments);
    }

    if (STANDALONE_MARKERS.has(marker)) {
      segments.push(input.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    if (offset + 3 >= input.length) {
      return input; // Truncated — bail out safely.
    }

    const length = input.readUInt16BE(offset + 2);
    const segmentEnd = offset + 2 + length;
    if (length < 2 || segmentEnd > input.length) {
      return input; // Malformed length — bail out safely.
    }

    const isExifApp1 =
      marker === 0xe1 &&
      length >= 2 + EXIF_IDENTIFIER.length &&
      input.subarray(offset + 4, offset + 4 + EXIF_IDENTIFIER.length).equals(EXIF_IDENTIFIER);

    if (!isExifApp1) {
      segments.push(input.subarray(offset, segmentEnd));
    }
    // isExifApp1: segment deliberately omitted — this is the strip.

    offset = segmentEnd;
  }

  // Fell off the end without reaching SOS/EOI — an unusual structure this
  // parser does not confidently recognize. Return the original unmodified.
  return input;
}

/** Only JPEG is stripped in this phase (security.md §27 B1). */
export function stripExifIfSupported(mimeType: string, bytes: Buffer): Buffer {
  if (mimeType === "image/jpeg") {
    return stripJpegExif(bytes);
  }
  return bytes;
}
