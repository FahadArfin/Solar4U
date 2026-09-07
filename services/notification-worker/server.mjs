import { serve, json, readJson } from "../shared/http.mjs";

const delivered = new Set();
serve({
  name: "notification-worker",
  port: Number(process.env.PORT || 4003),
  router: async (request, response, requestId) => {
    const url = new URL(request.url, "http://local");
    if (request.method === "POST" && url.pathname === "/v1/notifications/deliver") {
      const body = await readJson(request);
      const idempotencyKey = request.headers["x-idempotency-key"] || body.idempotencyKey;
      if (!idempotencyKey) return json(response, 422, { error: "idempotency_key_required" }, requestId) || true;
      if (delivered.has(idempotencyKey)) return json(response, 200, { data: { status: "duplicate_ignored" } }, requestId) || true;
      delivered.add(idempotencyKey);
      console.log(JSON.stringify({ level: "info", event: "notification_preview", channel: body.channel || "email", template: body.template, recipient: body.recipient ? "[redacted]" : null }));
      return json(response, 202, { data: { status: process.env.EMAIL_PROVIDER ? "queued" : "local_preview", idempotencyKey } }, requestId) || true;
    }
    return false;
  },
});
