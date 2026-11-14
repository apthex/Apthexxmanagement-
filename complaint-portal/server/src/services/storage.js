import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { Readable } from "node:stream";
import sharp from "sharp";
import { parseBuffer } from "music-metadata";
import { put, get, del } from "@vercel/blob";
import { env } from "../config/env.js";

/**
 * Exported so tests can swap the SDK functions without module mocking.
 * The real SDK functions read `BLOB_READ_WRITE_TOKEN` from the environment.
 */
export const blobClient = { put, get, del };

const LOCAL_ROOT = path.resolve(env.STORAGE_LOCAL_DIR || path.join(process.cwd(), "storage"));
if (env.STORAGE_DRIVER === "local") fs.mkdirSync(LOCAL_ROOT, { recursive: true });

export function newStorageKey(prefix, extension) {
  return `${prefix}/${crypto.randomBytes(20).toString("hex")}${extension}`;
}

export async function saveObject(key, buffer, mime) {
  if (env.STORAGE_DRIVER === "vercel-blob") {
    // Private upload to the Vercel Blob store (`apthex-complaint-evidence`).
    // `BLOB_READ_WRITE_TOKEN` is server-only and is read automatically by the
    // SDK from process.env. `access: "private"` ensures the object cannot be
    // fetched without the server-side token, so private file URLs are never
    // exposed to the client. `key` is stored verbatim as the attachment
    // storage key so reads/deletes use the same pathname.
    await blobClient.put(key, buffer, {
      access: "private",
      contentType: mime,
    });
    return key;
  }
  const fullPath = path.join(LOCAL_ROOT, key);
  await fsp.mkdir(path.dirname(fullPath), { recursive: true, mode: 0o700 });
  await fsp.writeFile(fullPath, buffer, { mode: 0o600 });
  return key;
}

export async function readObject(key) {
  if (env.STORAGE_DRIVER === "vercel-blob") {
    // Stream the private blob from Vercel Blob using the server-side read
    // token. Evidence files are small (images ≤ 2 MB, voice ≤ 4.5 MB), so
    // buffering in memory is safe. The raw blob URL and token never leave the
    // server; `access: "private"` is required for private reads.
    const response = await blobClient.get(key, { access: "private" });
    if (!response) throw Object.assign(new Error("Blob not found"), { status: 404 });
    if (typeof response.arrayBuffer === "function") {
      return Buffer.from(await response.arrayBuffer());
    }
    // Test mocks return a readable stream instead of a full Response.
    const nodeStream = Readable.fromWeb(response.stream);
    const chunks = [];
    for await (const chunk of nodeStream) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  return fsp.readFile(path.join(LOCAL_ROOT, key));
}

export async function deleteObject(key) {
  try {
    if (env.STORAGE_DRIVER === "vercel-blob") {
      await blobClient.del([key]);
      return;
    }
    await fsp.unlink(path.join(LOCAL_ROOT, key));
  } catch (error) {
    if (env.STORAGE_DRIVER === "vercel-blob") {
      // Vercel Blob throws BlobNotFoundError (status 404) for missing objects;
      // treat as already-deleted so retention cleanup stays idempotent.
      if (error?.status === 404 || error?.message?.includes("does not exist")) return;
    } else if (error?.code !== "ENOENT") {
      throw error;
    }
  }
}

function signingKey() {
  return env.STORAGE_SIGNING_SECRET || env.SESSION_SECRET;
}

function localSignature(attachmentId, expires) {
  return crypto.createHmac("sha256", signingKey()).update(`attachment:${attachmentId}:${expires}`).digest("hex");
}

export async function signAttachmentUrl(attachment) {
  const expiresIn = env.STORAGE_SIGNED_URL_TTL_SECONDS;
  if (env.STORAGE_DRIVER === "vercel-blob") {
    // Vercel Blob private reads are authenticated server-side (the token never
    // leaves the server). The download route requires an authenticated staff
    // session + appropriate role, so no signature is needed in the URL.
    return {
      url: `/api/attachments/download/${attachment._id}`,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }
  const expires = Math.floor(Date.now() / 1000) + expiresIn;
  const signature = localSignature(String(attachment._id), expires);
  return {
    url: `/api/attachments/download/${attachment._id}?expires=${expires}&signature=${signature}`,
    expires_at: new Date(expires * 1000).toISOString(),
  };
}

export function verifyLocalSignature(attachmentId, expires, signature) {
  const expiry = Number(expires);
  if (!Number.isFinite(expiry) || expiry < Math.floor(Date.now() / 1000)) return false;
  const expected = localSignature(String(attachmentId), expiry);
  if (!signature || signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
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

export async function processVoice(buffer) {  if (buffer.length > env.MAX_VOICE_BYTES) {
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

export const storageDriver = env.STORAGE_DRIVER;
