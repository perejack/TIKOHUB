// Hashback M-Pesa STK Push service
// All status-mapping logic mirrors the fix applied to survayrogue & qiuckmartnaivascareefour

const HASHBACK_API_BASE_URL = "/api/hashback";

export class MpesaService {
  static formatPhone(phone: string): string {
    let cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0")) cleaned = "254" + cleaned.substring(1);
    if (cleaned.startsWith("+")) cleaned = cleaned.substring(1);
    if (!cleaned.startsWith("254")) cleaned = "254" + cleaned;
    return cleaned;
  }

  static isValidPhone(phone: string): boolean {
    if (!phone) return false;
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.startsWith("0") && cleaned.length === 10) return true;
    if (cleaned.startsWith("254") && cleaned.length === 12) return true;
    if ((cleaned.startsWith("7") || cleaned.startsWith("1")) && cleaned.length === 9) return true;
    return false;
  }

  /** Initiate a real Hashback STK push */
  static async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    reference: string,
  ): Promise<{ success: boolean; checkoutRequestId?: string; error?: string }> {
    try {
      if (!this.isValidPhone(phoneNumber)) {
        return { success: false, error: "Please enter a valid Kenyan M-Pesa number (e.g. 0712345678)" };
      }

      const response = await fetch(`${HASHBACK_API_BASE_URL}/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phoneNumber,
          amount: Math.round(Number(amount)),
          reference,
          referencePrefix: "SAFARI7S",
        }),
      });

      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok || !data || data.success === false) {
        return {
          success: false,
          error: (typeof data?.message === "string" ? data.message : null) ?? "Failed to initiate payment",
        };
      }

      const checkoutId =
        (typeof data.checkoutId === "string" ? data.checkoutId : null) ??
        (typeof data.checkoutRequestId === "string" ? data.checkoutRequestId : null);

      if (!checkoutId) {
        return { success: false, error: "Payment initiated but missing checkout ID" };
      }

      return { success: true, checkoutRequestId: checkoutId };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to initiate payment",
      };
    }
  }

  /** Poll Hashback for final status — never throws, always returns a value */
  static async getPaymentStatus(
    checkoutRequestId: string,
  ): Promise<"completed" | "failed" | "pending"> {
    try {
      const response = await fetch(`${HASHBACK_API_BASE_URL}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId: checkoutRequestId }),
      });

      const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;

      if (!response.ok || !data) return "pending";
      if (data.status === "error") return "pending";

      const status = String(data.status ?? data.state ?? "").toLowerCase();
      const rawStatus = String(data.rawStatus ?? "").toLowerCase();
      const resultDesc = String(data.resultDesc ?? "").toLowerCase();

      // ── Success ────────────────────────────────────────────────────────────
      if (
        status === "paid" ||
        status === "success" ||
        status === "completed" ||
        rawStatus === "completed" ||
        rawStatus === "success" ||
        rawStatus === "paid" ||
        resultDesc.includes("success") ||
        resultDesc.includes("processed successfully")
      ) {
        return "completed";
      }

      // ── Conclusive failure ─────────────────────────────────────────────────
      if (
        status === "failed" ||
        rawStatus === "failed" ||
        rawStatus === "cancelled" ||
        rawStatus === "canceled" ||
        resultDesc.includes("cancel") ||
        resultDesc.includes("insufficient") ||
        resultDesc.includes("wrong pin") ||
        resultDesc.includes("invalid pin") ||
        resultDesc.includes("user cannot be reached") ||
        resultDesc.includes("ds timeout") ||
        resultDesc.includes("timed out") ||
        resultDesc.includes("timeout")
      ) {
        return "failed";
      }

      return "pending";
    } catch {
      return "pending";
    }
  }
}
