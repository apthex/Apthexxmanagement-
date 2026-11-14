import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";

/*
 * Vercel Blob storage layer tests.
 *
 * The @vercel/blob SDK functions are swapped out through the exported
 * `blobClient` object (Node's test runner here provides no module mocking), so
 * no network request is made and no real blob store is touched.
 *
 * The driver and token are saved/restored so other suites (local driver) are
 * unaffected. Every test re-asserts the driver explicitly: test files share one
 * process in `node --test` and mutate the shared env singleton.
 */
import { env } from "../src/config/env.js";
import {
  saveObject,
  readObject,
  deleteObject,
  signAttachmentUrl,
  blobClient,
} from "../src/services/storage.js";

const originalDriver = env.STORAGE_DRIVER;
const originalToken = env.BLOB_READ_WRITE_TOKEN;
const originalProcessToken = process.env.BLOB_READ_WRITE_TOKEN;

test.after(() => {
  env.STORAGE_DRIVER = originalDriver;
  env.BLOB_READ_WRITE_TOKEN = originalToken;
  if (originalProcessToken === undefined) {
    delete process.env.BLOB_READ_WRITE_TOKEN;
  } else {
    process.env.BLOB_READ_WRITE_TOKEN = originalProcessToken;
  }
});

// Swaps blobClient methods for the duration of a test, restoring afterwards.
function withMockedBlobClient(overrides, run) {
  const original = Object.assign({}, blobClient);
  Object.assign(blobClient, overrides);
  return Promise.resolve()
    .then(run)
    .finally(() => Object.assign(blobClient, original));
}

test("signAttachmentUrl returns a server-proxied path, never a raw blob URL", async () => {
  env.STORAGE_DRIVER = "vercel-blob";
  const attachment = {
    _id: "000000000000000000000001",
    storage_key: "image/abc123.jpg",
    mime: "image/jpeg",
    type: "image",
    complaint_id: "complaint-1",
  };
  const signed = await signAttachmentUrl(attachment);
  assert.strictEqual(signed.url, "/api/attachments/download/000000000000000000000001");
  assert.ok(signed.expires_at);
  assert.ok(!signed.url.includes("blob."));
  assert.ok(!signed.url.includes("vercel-storage"));
  assert.ok(!signed.url.includes("downloadUrl"));
  assert.ok(!signed.url.includes("signature="));
});

test("local driver still signs attachment URLs with a signature", async () => {
  env.STORAGE_DRIVER = "local";
  try {
    const attachment = {
      _id: "000000000000000000000002",
      storage_key: "image/abc123.jpg",
      mime: "image/jpeg",
      type: "image",
      complaint_id: "complaint-2",
    };
    const signed = await signAttachmentUrl(attachment);
    assert.ok(signed.url.includes("signature="));
    assert.ok(signed.url.includes("/api/attachments/download/000000000000000000000002"));
  } finally {
    env.STORAGE_DRIVER = "vercel-blob";
  }
});

test("saveObject uploads privately through the SDK with contentType", async () => {
  env.STORAGE_DRIVER = "vercel-blob";
  const buffer = Buffer.from("evidence-image-bytes");
  const putMock = mock.fn(async () => ({}));
  await withMockedBlobClient({ put: putMock }, async () => {
    const returned = await saveObject("image/__test_blob.jpg", buffer, "image/jpeg");
    assert.strictEqual(returned, "image/__test_blob.jpg");
    assert.strictEqual(putMock.mock.callCount(), 1);
    assert.deepEqual(putMock.mock.calls[0].arguments, [
      "image/__test_blob.jpg",
      buffer,
      { access: "private", contentType: "image/jpeg" },
    ]);
  });
});

test("readObject streams the private blob and buffers it completely", async () => {
  env.STORAGE_DRIVER = "vercel-blob";
  const buffer = Buffer.from("private-evidence-payload");
  const getMock = mock.fn(async () => ({
    statusCode: 200,
    stream: Readable.toWeb(Readable.from([buffer])),
  }));
  await withMockedBlobClient({ get: getMock }, async () => {
    const result = await readObject("image/__test_blob.jpg");
    assert.ok(Buffer.isBuffer(result));
    assert.ok(result.equals(buffer));
    assert.deepEqual(getMock.mock.calls[0].arguments, [
      "image/__test_blob.jpg",
      { access: "private" },
    ]);
  });
});

test("readObject maps a missing blob to a 404 error", async () => {
  env.STORAGE_DRIVER = "vercel-blob";
  // SDK get() resolves null when the blob does not exist.
  await withMockedBlobClient({ get: mock.fn(async () => null) }, async () => {
    await assert.rejects(readObject("image/__test_missing.jpg"), (error) => {
      assert.strictEqual(error.status, 404);
      return true;
    });
  });
});

test("deleteObject deletes through the SDK with the storage key", async () => {
  env.STORAGE_DRIVER = "vercel-blob";
  const delMock = mock.fn(async () => ({}));
  await withMockedBlobClient({ del: delMock }, async () => {
    await deleteObject("voice/__test_blob.webm");
    assert.strictEqual(delMock.mock.callCount(), 1);
    assert.deepEqual(delMock.mock.calls[0].arguments, [["voice/__test_blob.webm"]]);
  });
});

test("deleteObject is idempotent when the blob is already gone", async () => {
  env.STORAGE_DRIVER = "vercel-blob";
  const delMock = mock.fn(async () => {
    throw Object.assign(new Error("Blob not found"), {
      status: 404,
      name: "BlobNotFoundError",
    });
  });
  await withMockedBlobClient({ del: delMock }, async () => {
    await deleteObject("voice/__test_blob.webm"); // must not throw
  });
});

test("saveObject fails safely without BLOB_READ_WRITE_TOKEN", async () => {
  env.STORAGE_DRIVER = "vercel-blob";
  env.BLOB_READ_WRITE_TOKEN = "";
  const original = Object.assign({}, blobClient); // real SDK functions
  const savedProcessToken = process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_READ_WRITE_TOKEN; // SDK reads the raw env variable
  try {
    await assert.rejects(
      saveObject("image/__test_blob.jpg", Buffer.from("evidence"), "image/jpeg"),
      (error) => {
        assert.ok(error instanceof Error);
        return true;
      }
    );
  } finally {
    Object.assign(blobClient, original);
    if (savedProcessToken === undefined) {
      delete process.env.BLOB_READ_WRITE_TOKEN;
    } else {
      process.env.BLOB_READ_WRITE_TOKEN = savedProcessToken;
    }
    env.BLOB_READ_WRITE_TOKEN = originalToken;
  }
});
