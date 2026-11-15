import crypto from "crypto";
import sharp from "sharp";
import { parseBuffer } from "music-metadata";
import { env } from "../config/env.js";

export function newStorageKey(prefix, extension) {
  return `${prefix}/${crypto.randomBytes(20).toString("hex")}${extension}`;
}

const ALLOWED_IMAGE_FORMATS = new Set(["jpeg", "png", "webp", "gif"]);

export async function processImage(buffer) {
  const probe = await sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 }).metadata();
  if (!probe.format || !ALLOWED_IMAGE_FORMATS.has(probe.format)) {
    throw Object.assign(new Error("Unsupported image format"), { status: 400 });
  }
  if (!probe.width || !probe.height || probe.width * probe.height > 40_000_000) {
    throw Object.assign(new Error("Image dimensions are too large"), { status: 400 });
  }

  async function render(quality, maxDimension) {
    return sharp(buffer, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }

  let quality = 82;
  let maxDimension = 2400;
  let output = await render(quality, maxDimension);
  while (output.length > env.MAX_IMAGE_BYTES && quality > 40) {
    quality -= 10;
    output = await render(quality, maxDimension);
  }
  while (output.length > env.MAX_IMAGE_BYTES && maxDimension > 1000) {
    maxDimension -= 400;
    output = await render(quality, maxDimension);
  }
  if (output.length > env.MAX_IMAGE_BYTES) {
    throw Object.assign(new Error("Image could not be compressed below 2 MB"), { status: 400 });
  }
  // Re-encoding through sharp removes EXIF, GPS and other metadata.
  return { buffer: output, mime: "image/jpeg", ext: ".jpg" };
}

const AUDIO_SIGNATURES = [
  { mime: "audio/webm", ext: ".webm", test: (b) => b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
  { mime: "audio/ogg", ext: ".ogg", test: (b) => b.subarray(0, 4).toString("ascii") === "OggS" },
  { mime: "audio/wav", ext: ".wav", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WAVE" },
  {
    mime: "audio/mp4",
    ext: ".m4a",
    test: (b) => b.length > 12 && b.subarray(4, 8).toString("ascii") === "ftyp" && /M4A|isom|mp42/.test(b.subarray(8, 16).toString("ascii")),
  },
  { mime: "audio/mpeg", ext: ".mp3", test: (b) => b.subarray(0, 3).toString("ascii") === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
];

export async function processVoice(buffer) {
  if (buffer.length > env.MAX_VOICE_BYTES) {
    throw Object.assign(new Error("Voice recording is too large"), { status: 400 });
  }
  const detected = AUDIO_SIGNATURES.find((entry) => entry.test(buffer));
  if (!detected) {
    throw Object.assign(new Error("Invalid or unsupported audio file"), { status: 400 });
  }
  let metadata;
  try {
    metadata = await parseBuffer(buffer, { mimeType: detected.mime, size: buffer.length });
  } catch {
    throw Object.assign(new Error("Could not read the audio recording"), { status: 400 });
  }
  const duration = metadata?.format?.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw Object.assign(new Error("Could not determine the audio duration"), { status: 400 });
  }
  if (duration > env.MAX_VOICE_SECONDS + 0.5) {
    throw Object.assign(new Error(`Voice recordings must be ${env.MAX_VOICE_SECONDS} seconds or shorter`), { status: 400 });
  }
  return { buffer, mime: detected.mime, ext: detected.ext, duration };
}

// Video files are stored as-is (no re-encoding): only the container signature
// is verified so random renamed files cannot be smuggled in as "video".
const VIDEO_SIGNATURES = [
  { mime: "video/mp4", ext: ".mp4", test: (b) => b.length > 12 && b.subarray(4, 8).toString("ascii") === "ftyp" },
  { mime: "video/webm", ext: ".webm", test: (b) => b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3 },
];

export async function processVideo(buffer) {
  if (buffer.length > env.MAX_VIDEO_BYTES) {
    throw Object.assign(new Error("Video is too large (max 50 MB)"), { status: 400 });
  }
  const detected = VIDEO_SIGNATURES.find((entry) => entry.test(buffer));
  if (!detected) {
    throw Object.assign(new Error("Invalid or unsupported video file (MP4/WebM only)"), { status: 400 });
  }
  return { buffer, mime: detected.mime, ext: detected.ext };
}

export const storageDriver = "mongodb";
