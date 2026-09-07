import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

export function json(response, status, body, requestId) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": process.env.CORS_ORIGIN || "http://localhost:3000",
    "access-control-allow-headers": "content-type,x-idempotency-key,x-solar4u-admin-token",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "x-request-id": requestId,
  });
  response.end(JSON.stringify(body));
}

export async function readJson(request) {
  const chunks = [];
  const maximumBytes = Number(process.env.MAX_JSON_BODY_BYTES || 262144);
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maximumBytes) {
      const error = new Error("payload_too_large");
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export function serve({ name, port, router, readiness }) {
  const server = createServer(async (request, response) => {
    const requestId = request.headers["x-request-id"] || randomUUID();
    if (request.method === "OPTIONS") return json(response, 204, {}, requestId);
    if (request.url === "/healthz") return json(response, 200, { service: name, status: "ok", time: new Date().toISOString() }, requestId);
    if (request.url === "/readyz") {
      try {
        const details = readiness ? await readiness() : {};
        return json(response, 200, { service: name, ready: true, ...details }, requestId);
      } catch {
        return json(response, 503, { service: name, ready: false }, requestId);
      }
    }
    try {
      const handled = await router(request, response, requestId);
      if (!handled) json(response, 404, { error: "not_found", requestId }, requestId);
    } catch (error) {
      console.error(JSON.stringify({ level: "error", service: name, requestId, message: error.message }));
      json(response, 500, { error: "internal_error", requestId }, requestId);
    }
  });
  server.listen(port, "0.0.0.0", () => console.log(JSON.stringify({ level: "info", service: name, port, event: "listening" })));
  return server;
}
