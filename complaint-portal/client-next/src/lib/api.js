let csrfToken = null;

export function setCsrfToken(token) {
  if (typeof token === "string" && token) csrfToken = token;
}

export function getCsrfToken() {
  return csrfToken;
}

export class ApiError extends Error {
  constructor(message, { status = 0, fields = null, data = null } = {}) {
    super(message || "Request failed");
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
    this.data = data;
  }
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}

export async function api(path, { method = "GET", json, form, headers = {}, signal } = {}) {
  const requestHeaders = { Accept: "application/json", ...headers };
  const options = { method, credentials: "include", signal, headers: requestHeaders };

  if (json !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
    options.body = JSON.stringify(json);
  } else if (form) {
    options.body = form;
  }

  if (!["GET", "HEAD"].includes(method) && csrfToken) {
    requestHeaders["X-CSRF-Token"] = csrfToken;
  }

  let response;
  try {
    response = await fetch(path, options);
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new ApiError("Could not reach the portal. Check your connection and try again.");
  }
  const data = await parseResponse(response);
  if (data?.csrfToken) setCsrfToken(data.csrfToken);
  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status})`, {
      status: response.status,
      fields: data?.fields || null,
      data,
    });
  }
  return data;
}

/**
 * Multipart upload with real progress events. XHR is used because fetch does
 * not expose upload progress in all supported browsers.
 */
export function submitComplaint(form, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/complaints");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onerror = () => reject(new ApiError("Could not reach the portal. Check your connection and try again."));
    xhr.onload = () => {
      let data = null;
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        data = { error: xhr.responseText };
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data);
      } else {
        reject(
          new ApiError(data?.error || `Submission failed (${xhr.status})`, {
            status: xhr.status,
            fields: data?.fields || null,
            data,
          })
        );
      }
    };
    xhr.send(form);
  });
}
