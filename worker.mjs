async function submitDemo(request, env) {
  const fail = (error, status) =>
    Response.json(
      { error },
      {
        status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return fail("Please submit this form from the CoreAML website.", 403);
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return fail("Invalid request format.", 415);
  }
  if (!env.COREAML_DEMO_FUNCTION_URL || !env.COREAML_DEMO_RELAY_SECRET) {
    return fail("Demo requests are temporarily unavailable.", 503);
  }

  // Bound the request before forwarding it to the private Edge Function.
  const reader = request.body?.getReader();
  if (!reader) return fail("Invalid request format.", 400);
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 12000) {
        await reader.cancel();
        return fail("Request too large.", 413);
      }
      chunks.push(value);
    }
    const response = await fetch(env.COREAML_DEMO_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-coreaml-demo-key": env.COREAML_DEMO_RELAY_SECRET,
      },
      body: new Blob(chunks),
      signal: AbortSignal.timeout(13500),
    });
    if (
      response.status >= 500 ||
      !response.headers.get("content-type")?.includes("application/json")
    ) {
      return fail(
        "We could not confirm your request. Retry to confirm the same submission.",
        503,
      );
    }
    return response;
  } catch {
    return fail(
      "We could not confirm your request. Retry to confirm the same submission.",
      503,
    );
  }
}

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname !== "/api/demo") {
      return env.ASSETS.fetch(request);
    }
    if (request.method !== "POST") {
      return Response.json(
        { error: "Use POST to submit a demo request." },
        {
          status: 405,
          headers: { Allow: "POST", "Cache-Control": "no-store" },
        },
      );
    }
    return submitDemo(request, env);
  },
};
