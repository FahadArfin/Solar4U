import { serve, json, readJson } from "../shared/http.mjs";
import { components, validateDiagram } from "./rules.mjs";

serve({
  name: "diagram-service",
  port: Number(process.env.PORT || 4002),
  router: async (request, response, requestId) => {
    const url = new URL(request.url, "http://local");
    if (request.method === "GET" && url.pathname === "/v1/diagrams/components") return json(response, 200, { data: components }, requestId) || true;
    if (request.method === "POST" && url.pathname === "/v1/diagrams/validate") return json(response, 200, { data: validateDiagram(await readJson(request)) }, requestId) || true;
    if (request.method === "POST" && url.pathname === "/v1/diagrams/export") {
      const body = await readJson(request);
      return json(response, 202, { data: { exportId: `local-${Date.now()}`, format: body.format || "json", status: "ready", payload: body.diagram || {} } }, requestId) || true;
    }
    return false;
  },
});
