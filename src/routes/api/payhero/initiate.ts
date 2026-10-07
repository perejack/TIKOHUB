import { createAPIFileRoute } from "@tanstack/react-start/api";

const PAYHERO_BASE_URL = "https://backend.payhero.co.ke";
const PAYHERO_AUTH_HEADER =
  "Basic Umt6bU9HaFBNWDB3YzQxNzVwcXA6YWJHZllweFZWblplcGVNQTRjQ0FISHBVY2VXQllxRXF4TnpNVnp1Tw==";
const PAYHERO_CHANNEL_ID = 13712;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function normalizePhone(phone: string | undefined | null): string | null {
  if (!phone) return null;
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.startsWith("254") && cleaned.length === 12) return cleaned;
  if (cleaned.startsWith("0") && cleaned.length === 10) return "254" + cleaned.slice(1);
  if ((cleaned.startsWith("7") || cleaned.startsWith("1")) && cleaned.length === 9)
    return "254" + cleaned;
  if (cleaned.startsWith("2540") && cleaned.length === 13) return "254" + cleaned.slice(4);
  return null;
}

function extractReference(data: Record<string, unknown>): string | null {
  const keys = ["reference", "Reference", "checkoutId", "checkoutRequestId", "CheckoutRequestID"];
  for (const k of keys) {
    if (typeof data[k] === "string" && (data[k] as string).trim()) return data[k] as string;
  }
  const nested = data.data;
  if (nested && typeof nested === "object") {
    const n = nested as Record<string, unknown>;
    for (const k of keys) {
      if (typeof n[k] === "string" && (n[k] as string).trim()) return n[k] as string;
    }
  }
  return null;
}

export const APIRoute = createAPIFileRoute("/api/payhero/initiate")({
  OPTIONS: async () => {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  },

  POST: async ({ request }) => {
    const headers = { ...CORS_HEADERS, "Content-Type": "application/json" };

    let body: Record<string, unknown> = {};
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid JSON body" }),
        { status: 400, headers }
      );
    }

    const rawPhone =
      (typeof body.phone === "string" ? body.phone : undefined) ??
      (typeof body.phoneNumber === "string" ? body.phoneNumber : undefined) ??
      (typeof body.phone_number === "string" ? body.phone_number : undefined);

    const normalizedPhone = normalizePhone(rawPhone);
    if (!normalizedPhone) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid phone number format" }),
        { status: 400, headers }
      );
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, message: "Invalid amount" }),
        { status: 400, headers }
      );
    }

    const referencePrefix =
      typeof body.referencePrefix === "string" ? body.referencePrefix : "TIKOHUB";
    const externalReference =
      typeof body.reference === "string"
        ? body.reference
        : `${referencePrefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const payload = {
      amount: Math.round(amount),
      phone_number: normalizedPhone,
      channel_id: PAYHERO_CHANNEL_ID,
      provider: "m-pesa",
      external_reference: externalReference,
      customer_name: typeof body.customer_name === "string" ? body.customer_name : undefined,
      description:
        typeof body.description === "string" ? body.description : "TIKOHUB Ticket Purchase",
    };

    let phRes: Response;
    let data: Record<string, unknown> | null = null;
    try {
      phRes = await fetch(`${PAYHERO_BASE_URL}/api/v2/payments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: PAYHERO_AUTH_HEADER,
        },
        body: JSON.stringify(payload),
      });
      data = (await phRes.json().catch(() => null)) as Record<string, unknown> | null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error calling PayHero";
      return new Response(JSON.stringify({ success: false, message: msg }), {
        status: 502,
        headers,
      });
    }

    if (!phRes.ok || !data) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            (typeof data?.error_message === "string" ? data.error_message : null) ??
            (typeof data?.message === "string" ? data.message : null) ??
            "Payment initiation failed",
          raw: data,
        }),
        { status: phRes.status || 500, headers }
      );
    }

    const checkoutId = extractReference(data);
    const success =
      data.success === true ||
      String(data.status ?? "").toLowerCase() === "success" ||
      Boolean(checkoutId);

    if (!success || !checkoutId) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            (typeof data.message === "string" ? data.message : null) ??
            "Payment initiation failed",
          raw: data,
        }),
        { status: 400, headers }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        checkoutId,
        checkoutRequestId: checkoutId,
        reference: externalReference,
        normalizedPhone,
        message: typeof data.message === "string" ? data.message : "STK push initiated",
        raw: data,
      }),
      { status: 200, headers }
    );
  },
});
