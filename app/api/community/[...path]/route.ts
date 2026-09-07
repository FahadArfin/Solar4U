const LOCAL_USER_ID = "00000000-0000-0000-0000-000000000001";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function proxyCommunityRequest(request: Request, context: RouteContext) {
  // The seeded local profile must never become a shared production identity.
  if (process.env.AUTH_MODE !== "local" || process.env.ENABLE_LOCAL_FORUM !== "true") {
    return Response.json({ error: "forum_not_enabled", message: "The development forum is disabled. No shared development identity is available on the hosted site." }, { status: 403 });
  }
  const { path } = await context.params;
  const upstreamBase = process.env.PLATFORM_API_URL || "http://127.0.0.1:4000";
  const upstream = new URL(`/v1/${path.map(encodeURIComponent).join("/")}`, upstreamBase);
  upstream.search = new URL(request.url).search;

  const headers = new Headers({
    accept: "application/json",
    "content-type": request.headers.get("content-type") || "application/json",
    "x-solar4u-user-id": LOCAL_USER_ID,
    "x-solar4u-internal": process.env.FORUM_INTERNAL_TOKEN || "solar4u-local-forum",
  });
  const idempotencyKey = request.headers.get("x-idempotency-key");
  if (idempotencyKey) headers.set("x-idempotency-key", idempotencyKey);

  try {
    const upstreamResponse = await fetch(upstream, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.arrayBuffer(),
      cache: "no-store",
    });
    const responseHeaders = new Headers({
      "content-type":
        upstreamResponse.headers.get("content-type") ||
        "application/json; charset=utf-8",
    });
    const requestId = upstreamResponse.headers.get("x-request-id");
    if (requestId) responseHeaders.set("x-request-id", requestId);
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch {
    return Response.json(
      {
        error: "community_service_unavailable",
        message: "The local forum service is not ready yet. Please try again.",
      },
      { status: 503 },
    );
  }
}

export const dynamic = "force-dynamic";

export const GET = proxyCommunityRequest;
export const POST = proxyCommunityRequest;
export const PUT = proxyCommunityRequest;
export const PATCH = proxyCommunityRequest;
export const DELETE = proxyCommunityRequest;
