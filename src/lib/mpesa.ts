// HashBack Direct STK Push M-Pesa Integration Service
import { toast } from "sonner";

const HASHBACK_API_BASE_URL = "/api/hashback";

export type HashbackInitiateResponse = {
  success: boolean;
  checkoutId?: string;
  checkoutRequestId?: string;
  reference?: string;
  message?: string;
};

export type HashbackStatusResponse = {
  success: boolean;
  status: "paid" | "failed" | "pending" | "error";
  state?: string;
  rawStatus?: string;
  resultDesc?: string;
  receiptNumber?: string | null;
  message?: string;
};

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

  static async initiateSTKPush(
    phoneNumber: string,
    amount: number,
    accountReference: string,
    transactionDesc: string = "Safari 7s Tickets"
  ): Promise<{ success: boolean; checkoutRequestId?: string; error?: string }> {
    try {
      if (!this.isValidPhone(phoneNumber)) {
        return { success: false, error: "Please enter a valid Kenyan M-Pesa phone number (e.g. 07XX XXX XXX)" };
      }

      const formattedPhone = this.formatPhone(phoneNumber);
      const reference = accountReference || `SAFARI7S-${Date.now()}`;

      const response = await fetch(`${HASHBACK_API_BASE_URL}/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: formattedPhone,
          amount: Math.round(Number(amount)),
          description: transactionDesc,
          reference,
          referencePrefix: "SAFARI7S",
        }),
      });

      const data: HashbackInitiateResponse | null = await response.json().catch(() => null);

      if (!response.ok || !data || data.success === false) {
        console.error("HashBack payment initiation failed:", data);
        return {
          success: false,
          error: data?.message || "Failed to initiate payment",
        };
      }

      const checkoutId = data.checkoutId ?? data.checkoutRequestId;
      if (!checkoutId) {
        return { success: false, error: "Payment initiated but missing checkoutId" };
      }

      return {
        success: true,
        checkoutRequestId: checkoutId,
      };
    } catch (error: any) {
      console.error("HashBack STK Push Error:", error);
      return { success: false, error: error.message || "Failed to initiate payment" };
    }
  }

  static async checkTransactionStatus(checkoutRequestId: string): Promise<HashbackStatusResponse> {
    try {
      const response = await fetch(`${HASHBACK_API_BASE_URL}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkoutId: checkoutRequestId }),
      });

      const data: HashbackStatusResponse | null = await response.json().catch(() => null);

      if (!response.ok || !data) {
        return { success: false, status: "pending" };
      }

      if (data.status === "error") {
        return { success: false, status: "pending" };
      }

      return data;
    } catch {
      return { success: false, status: "pending" };
    }
  }

  static async getPaymentStatus(checkoutRequestId: string): Promise<"completed" | "failed" | "pending"> {
    const data = await this.checkTransactionStatus(checkoutRequestId);

    const status = String(data.status ?? data.state ?? "").toLowerCase();
    const rawStatus = String(data.rawStatus ?? "").toLowerCase();
    const resultDesc = String(data.resultDesc ?? "").toLowerCase();

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
  }

  static async pollPaymentStatus(
    checkoutRequestId: string,
    onComplete: () => void,
    onFailed: () => void,
    maxAttempts: number = 24,
    onAttempt?: (attempt: number) => void
  ) {
    let attempts = 0;

    const checkStatus = async () => {
      if (attempts >= maxAttempts) {
        onFailed();
        return;
      }
      attempts++;
      if (onAttempt) onAttempt(attempts);

      try {
        const status = await this.getPaymentStatus(checkoutRequestId);
        console.log("Payment status:", status);

        if (status === "completed") {
          onComplete();
          return;
        }

        if (status === "failed") {
          onFailed();
          return;
        }

        setTimeout(checkStatus, 5000);
      } catch (error) {
        console.error("Poll error:", error);
        setTimeout(checkStatus, 5000);
      }
    };

    setTimeout(checkStatus, 5000);
  }
}
