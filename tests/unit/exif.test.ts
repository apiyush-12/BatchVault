import { describe, expect, it } from "vitest";

import { stripExifIfSupported, stripJpegExif } from "@/features/media/exif";

/**
 * Pure-function coverage for the server-side half of the B1 decision
 * (security.md §27; testing.md §2.1) — JPEG EXIF `APP1` segment removal,
 * byte-segment-level, no re-encode.
 */

const SOI = Buffer.from([0xff, 0xd8]);
const EOI = Buffer.from([0xff, 0xd9]);

function app1ExifSegment(payloadLength = 20): Buffer {
  // Marker (0xFF 0xE1) + 2-byte length (includes itself) + "Exif\0\0" + payload.
  const identifier = Buffer.from("Exif\0\0", "latin1");
  const payload = Buffer.alloc(payloadLength, 0xab);
  const length = 2 + identifier.length + payload.length;
  const header = Buffer.from([0xff, 0xe1, (length >> 8) & 0xff, length & 0xff]);
  return Buffer.concat([header, identifier, payload]);
}

function otherApp0Segment(): Buffer {
  // A JFIF APP0 segment — must survive the strip untouched.
  const payload = Buffer.from("JFIF\0", "latin1");
  const length = 2 + payload.length;
  const header = Buffer.from([0xff, 0xe0, (length >> 8) & 0xff, length & 0xff]);
  return Buffer.concat([header, payload]);
}

function sosAndScanData(): Buffer {
  const sos = Buffer.from([0xff, 0xda]);
  const scanData = Buffer.from([0x01, 0x02, 0x03, 0xff, 0x00, 0x04]); // includes a stuffed 0xFF00
  return Buffer.concat([sos, scanData, EOI]);
}

describe("stripJpegExif", () => {
  it("removes the EXIF APP1 segment entirely, preserving everything else", () => {
    const input = Buffer.concat([SOI, app1ExifSegment(), otherApp0Segment(), sosAndScanData()]);
    const output = stripJpegExif(input);

    expect(output.includes(Buffer.from("Exif\0\0", "latin1"))).toBe(false);
    // SOI, the surviving APP0, and the scan data are all still present.
    expect(output.subarray(0, 2)).toEqual(SOI);
    expect(output.includes(Buffer.from("JFIF\0", "latin1"))).toBe(true);
    expect(output.subarray(output.length - 1)).toEqual(Buffer.from([0xd9]));
  });

  it("leaves a JPEG with no EXIF segment byte-for-byte unchanged", () => {
    const input = Buffer.concat([SOI, otherApp0Segment(), sosAndScanData()]);
    const output = stripJpegExif(input);
    expect(output.equals(input)).toBe(true);
  });

  it("never touches compressed scan data, even when it contains byte sequences that look like markers", () => {
    const input = Buffer.concat([SOI, app1ExifSegment(), sosAndScanData()]);
    const output = stripJpegExif(input);
    // The stuffed 0xFF 0x00 inside the scan data must survive verbatim.
    expect(output.includes(Buffer.from([0xff, 0x00, 0x04]))).toBe(true);
  });

  it("returns input unmodified for a non-JPEG buffer (fails safe)", () => {
    const input = Buffer.from("not a jpeg at all", "utf8");
    expect(stripJpegExif(input)).toBe(input);
  });

  it("returns input unmodified for a truncated/malformed JPEG (fails safe)", () => {
    const input = Buffer.concat([SOI, Buffer.from([0xff, 0xe1, 0x00])]); // length byte missing
    expect(stripJpegExif(input)).toBe(input);
  });
});

describe("stripExifIfSupported", () => {
  it("strips JPEG", () => {
    const input = Buffer.concat([SOI, app1ExifSegment(), sosAndScanData()]);
    const output = stripExifIfSupported("image/jpeg", input);
    expect(output.includes(Buffer.from("Exif\0\0", "latin1"))).toBe(false);
  });

  it("passes PNG/WebP/GIF through unmodified — a named, accepted gap (security.md §27 B1)", () => {
    const input = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    expect(stripExifIfSupported("image/png", input)).toBe(input);
    expect(stripExifIfSupported("image/webp", input)).toBe(input);
    expect(stripExifIfSupported("image/gif", input)).toBe(input);
  });
});
