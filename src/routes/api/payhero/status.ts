import { createAPIFileRoute } from "@tanstack/react-start/api";

const PAYHERO_BASE_URL = "https://backend.payhero.co.ke";
const PAYHERO_AUTH_HEADER =
  "Basic Umt6bU9HaFBNWDB3YzQxNzVwcXA6YWJHZllweFZWblplcGVNQTRjQ0FISHBVY2VXQllxRXF4TnpNVnp1Tw==";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function mapStatus(raw: string): "paid" | "failed" | "pending" {
  const s = raw.toLowerCase();
  if (["success", "paid", "complete", "completed"].includes(s)) return "paid";
  if (["failed", "failure", "cancelled", "canceled", "rejected"].includes(s)) return "failed";
  return "pending";
}

export const APIRoute = createAPIFileRoute("/api/payhero/status")({
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
        JSON.stringify({ success: false, status: "error", message: "Invalid JSON body" }),
        { status: 400, headers }
      );
    }

    const checkoutId =
      (typeof body.checkoutId === "string" ? body.checkoutId : undefined) ??
      (typeof body.checkoutRequestId === "string" ? body.checkoutRequestId : undefined) ??
      (typeof body.reference === "string" ? body.reference : undefined);

    if (!checkoutId) {
      return new Response(
        JSON.stringify({ success: false, status: "error", message: "Missing checkoutId" }),
        { status: 400, headers }
      );
    }

    let phRes: Response;
    let data: Record<string, unknown> | null = null;
    try {
      phRes = await fetch(
        `${PAYHERO_BASE_URL}/api/v2/transaction-status?reference=${encodeURIComponent(checkoutId)}`,
        {
          method: "GET",
          headers: {
            Authorization: PAYHERO_AUTH_HEADER,
          },
        }
      );
      data = (await phRes.json().catch(() => null)) as Record<string, unknown> | null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      return new Response(
        JSON.stringify({ success: false, status: "pending", message: msg }),
        { status: 502, headers }
      );
    }

    if (!phRes.ok || !data) {
      return new Response(
        JSON.stringify({ success: false, status: "pending", message: "Status check failed", raw: data }),
        { status: phRes.status || 500, headers }
      );
    }

    const rawStatus = String(
      data.status ?? data.Status ?? data.transaction_status ?? data.TransactionStatus ?? "pending"
    );
    const mapped = mapStatus(rawStatus);
    const receiptNumber =
      (data.receipt_number as string | undefined) ??
      (data.ReceiptNumber as string | undefined) ??
      (data.mpesa_receipt as string | undefined) ??
      null;

    const resultDesc = String(
      data.result_desc ?? data.ResultDesc ?? data.description ?? data.message ?? ""
    );

    return new Response(
      JSON.stringify({
        success: mapped === "paid",
        status: mapped,
        rawStatus,
        resultDesc,
        receiptNumber,
        state: rawStatus,
        raw: data,
      }),
      { status: 200, headers }
    );
  },
});
