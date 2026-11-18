const topics = [
  "CoreAML demonstration",
  "Core banking solution",
  "Core banking integration",
  "Security and deployment",
];
const reply = (data, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
async function submitDemo(request) {
  try {
    const relaySecret = Deno.env.get("COREAML_DEMO_RELAY_SECRET");
    if (
      !relaySecret ||
      request.headers.get("x-coreaml-demo-key") !== relaySecret
    ) {
      return reply({ error: "Unauthorized." }, 401);
    }
    if (request.method !== "POST") return reply({ error: "Use POST." }, 405);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return reply({ error: "Invalid request format." }, 415);
    if (Number(request.headers.get("content-length") || 0) > 12000)
      return reply({ error: "Request too large." }, 413);
    const raw = await request.text();
    if (raw.length > 10000) return reply({ error: "Request too large." }, 413);
    let p;
    try {
      p = JSON.parse(raw);
    } catch {
      return reply({ error: "Invalid request format." }, 400);
    }
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      return reply({ error: "Invalid request format." }, 400);
    }
    if (p.website)
      return reply({ error: "We could not accept this request." }, 400);
    const clean = (x, min, max) =>
      typeof x === "string" && x.trim().length >= min && x.trim().length <= max
        ? x.trim()
        : null;
    const name = clean(p.name, 2, 100),
      email = clean(p.email, 3, 254)?.toLowerCase(),
      institution = clean(p.institution, 2, 160),
      role = clean(p.role, 2, 100),
      country = clean(p.country, 2, 80),
      notes = clean(p.notes ?? "", 0, 1500);
    if (
      !name ||
      !email ||
      !/^\S+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !institution ||
      !role ||
      !country ||
      notes === null ||
      !topics.includes(p.topic) ||
      p.consent !== true ||
      typeof p.requestId !== "string" ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(p.requestId)
    )
      return reply(
        { error: "Please complete the required fields and consent checkbox." },
        400,
      );
    const dbUrl = Deno.env.get("SUPABASE_URL");
    const dbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const mailKey = Deno.env.get("RESEND_API_KEY");
    const sender = Deno.env.get("COREAML_DEMO_FROM");
    if (!dbUrl || !dbKey || !mailKey || !sender) {
      return reply(
        { error: "Demo requests are temporarily unavailable." },
        503,
      );
    }
    const dbHeaders = {
      apikey: dbKey,
      Authorization: "Bearer " + dbKey,
      "Content-Type": "application/json",
    };
    const details = {
      name,
      institution,
      role,
      country,
      topic: p.topic,
      notes,
      consent: true,
      consent_version: "demo-contact-v1",
    };
    const recordResponse = await fetch(
      dbUrl + "/rest/v1/rpc/coreaml_record_demo",
      {
        method: "POST",
        headers: dbHeaders,
        body: JSON.stringify({
          p_id: p.requestId,
          p_email: email,
          p_details: details,
        }),
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!recordResponse.ok) throw new Error("Storage unavailable.");
    const record = await recordResponse.json();
    if (record.status === 409) {
      return reply(
        {
          error:
            "This reference belongs to a different request. Edit the details and submit again.",
        },
        409,
      );
    }
    if (record.status === 429) {
      return reply(
        {
          error:
            "You have already submitted several requests. Please try again later.",
        },
        429,
      );
    }
    if (
      ![200, 201].includes(record.status) ||
      typeof record.reference !== "string"
    ) {
      throw new Error("Unexpected storage response.");
    }
    if (!record.accepted) {
      const sent = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + mailKey,
          "Content-Type": "application/json",
          "Idempotency-Key": "coreaml-demo/" + record.reference,
        },
        body: JSON.stringify({
          from: sender,
          to: ["bexinnovation@outlook.com"],
          reply_to: email,
          subject: "New CoreAML demo request " + record.reference,
          text: [
            "Reference: " + record.reference,
            "Name: " + name,
            "Email: " + email,
            "Institution: " + institution,
            "Role: " + role,
            "Country: " + country,
            "Topic: " + p.topic,
            "Notes: " + (notes || "(none)"),
          ].join("\n"),
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (!sent.ok) throw new Error("Email unavailable.");
      const marked = await fetch(
        dbUrl + "/rest/v1/coreaml_demo_requests?id=eq." + p.requestId,
        {
          method: "PATCH",
          headers: dbHeaders,
          body: JSON.stringify({ email_accepted_at: new Date().toISOString() }),
          signal: AbortSignal.timeout(4000),
        },
      );
      if (!marked.ok) throw new Error("Email status could not be stored.");
    }
    return reply({ reference: record.reference }, record.status);
  } catch {
    return reply(
      {
        error:
          "We could not confirm your request. Retry to confirm the same submission.",
      },
      503,
    );
  }
}

Deno.serve(submitDemo);
