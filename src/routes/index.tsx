import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle, ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronDown, CreditCard, Heart,
  MapPin, Minus, Plus, Search, ShoppingCart, Smartphone, Sun, Ticket,
  UserRound, MapPinned, Share2, BadgePercent, Download, Loader2, X, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadTickets, makeTicketId, type TicketLine } from "@/lib/ticket-pdf";
import { MpesaService } from "@/lib/mpesa";
import { toast } from "sonner";
import eventArt from "@/assets/safari-7s-2026.jpg.asset.json";
import tikoHubLogo from "@/assets/tikohub-logo.png.asset.json";
import lionessesAway from "@/assets/lionesses-away.jpg.asset.json";
import lionessesHome from "@/assets/lionesses-home.jpg.asset.json";
import shujaaAway from "@/assets/shujaa-away.jpg.asset.json";
import shujaaHome from "@/assets/shujaa-home.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Safari 7s 2026 Tickets | TikoHUB" },
      { name: "description", content: "Book Safari 7s 2026 rugby tickets at Nyayo Stadium, Nairobi." },
      { property: "og:title", content: "Safari 7s 2026 Tickets | TikoHUB" },
      { property: "og:description", content: "Three days of thrilling rugby and entertainment at Nyayo Stadium." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SafariEvent,
});

const ticketGroups = [
  { day: "Fri, 9 Oct 2026", name: "Regular", price: 300 },
  { day: "Sat, 10 Oct 2026", name: "Wave 2 Regular Ticket", price: 750 },
  { day: "Sun, 11 Oct 2026", name: "Wave 2 Regular Ticket", price: 750 },
  { day: "Season pass · Sat & Sun", name: "Wave 2 Regular Season", price: 1000 },
];

const merch = [
  { name: "Lionesses Away Replica Jersey", sizes: "S M L XL XXL XS 3XL 4XL 5XL", image: lionessesAway.url },
  { name: "Lionesses Home Replica Jersey", sizes: "S M L XL XXL XS 3XL 4XL 5XL", image: lionessesHome.url },
  { name: "Shujaa Away Replica Jersey", sizes: "S M L XL XXL XS 3XL 4XL 5XL", image: shujaaAway.url },
  { name: "Shujaa Home Replica Jersey", sizes: "S M XL XXL 3XL 4XL 5XL XS L", image: shujaaHome.url },
] as const;

const MERCH_PRICE = 7000;

function Brand() {
  return <a href="#top" className="flex shrink-0 items-center" aria-label="TikoHUB home"><img src={tikoHubLogo.url} alt="TikoHUB" className="h-14 w-auto object-contain" /></a>;
}

function SiteHeader({ menuOpen, setMenuOpen, onHome }: { menuOpen: boolean; setMenuOpen: (open: boolean) => void; onHome?: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto grid h-20 max-w-[1450px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 lg:px-8">
        <div onClick={onHome}><Brand /></div>
        <label className="relative hidden max-w-md lg:block"><Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"/><input aria-label="Search events and shop" className="h-12 w-full rounded-full border border-border bg-panel pl-12 pr-4 outline-none focus:ring-2 focus:ring-ring" placeholder="Search events and shop..." /></label>
        <nav className="hidden items-center gap-8 xl:flex" aria-label="Main navigation">
          <a href="#tickets" onClick={onHome} className="border-b-2 border-ticket pb-2 font-semibold text-warm">Events</a><a href="#details">Calendar</a><a href="#merch">TikoSHOP</a><a href="#about">TikoSTORIES</a><a href="#tickets">My Tickets</a><a href="#about" className="flex items-center gap-1">About Us <ChevronDown className="size-4"/></a>
        </nav>
        <div className="flex items-center gap-2"><Button size="icon" variant="secondary" className="rounded-full" aria-label="Cart"><ShoppingCart/></Button><Button size="icon" variant="secondary" className="hidden rounded-full sm:inline-flex" aria-label="Theme"><Sun/></Button><Button size="icon" variant="secondary" className="rounded-full" aria-label="Account"><UserRound/></Button><Button size="icon" variant="ghost" className="rounded-full xl:hidden" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}><ChevronDown className={menuOpen ? "rotate-180" : ""}/></Button></div>
      </div>
      {menuOpen && <nav className="grid gap-1 border-t border-border bg-background p-4 xl:hidden"><a href="#tickets" onClick={onHome} className="rounded-md p-3 font-semibold">Events</a><a href="#merch" className="rounded-md p-3">TikoSHOP</a><a href="#details" className="rounded-md p-3">Calendar</a><a href="#about" className="rounded-md p-3">About Us</a></nav>}
    </header>
  );
}

type CheckoutProps = {
  counts: number[];
  added: string[];
  selectedSizes: Record<string, string>;
  total: number;
  onBack: () => void;
};

function CheckoutPage({ counts, added, selectedSizes, total, onBack }: CheckoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [payment, setPayment] = useState("prompt");
  const [agreed, setAgreed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [buyer, setBuyer] = useState({ name: "", email: "", phone: "" });
  const [payModalStep, setPayModalStep] = useState<"closed" | "phone" | "processing" | "failed">("closed");
  const [modalPhone, setModalPhone] = useState("+254");
  const [isSending, setIsSending] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [checkoutId, setCheckoutId] = useState("");
  const [pollAttempt, setPollAttempt] = useState(0);
  const [tickets] = useState<TicketLine[]>(() =>
    ticketGroups.flatMap((t, i) =>
      Array.from({ length: counts[i] ?? 0 }, () => ({
        type: t.name,
        price: t.price,
        day: t.day.replace("Season pass · ", ""),
        id: makeTicketId(),
      }))
    )
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [submitted]);

  // Open the M-Pesa modal directly at the phone input step
  const openMpesaModal = () => {
    setModalPhone(buyer.phone ? MpesaService.formatPhone(buyer.phone) : "+254");
    setErrorMsg("");
    setPayModalStep("phone");
  };

  // Submit phone number and trigger STK Push
  const handleSendSTK = async () => {
    const raw = modalPhone.trim();
    if (!MpesaService.isValidPhone(raw)) {
      toast.error("Please enter a valid Kenyan M-Pesa phone number (e.g. 07XX XXX XXX or +254 7...)");
      return;
    }

    setIsSending(true);
    setPayModalStep("processing");
    setErrorMsg("");
    setPollAttempt(0);

    const formatted = MpesaService.formatPhone(raw);
    const ref = `SAFARI7S-${Date.now()}`;
    const result = await MpesaService.initiateSTKPush(formatted, total, ref);

    setIsSending(false);

    if (!result.success || !result.checkoutRequestId) {
      setPayModalStep("failed");
      setErrorMsg(result.error || "Failed to initiate payment. Please check your phone number and try again.");
      toast.error(result.error || "Payment failed");
      return;
    }

    setCheckoutId(result.checkoutRequestId);
    toast.success("STK push sent! Check your phone and enter your M-Pesa PIN.");

    MpesaService.pollPaymentStatus(
      result.checkoutRequestId,
      () => {
        // Success
        setReceipt(`T${makeTicketId()}K`);
        setSubmitted(true);
        setPayModalStep("closed");
        toast.success("Payment confirmed!");
      },
      () => {
        // Timeout / Failed
        setPayModalStep("failed");
        setErrorMsg('Payment verification is taking longer than expected. If money was deducted, click "I Have Already Paid".');
        toast.error("Payment confirmation timed out");
      },
      24,
      (attempt) => {
        setPollAttempt(attempt);
      }
    );
  };

  // Manual status check
  const manualCheck = async () => {
    if (!checkoutId) return;
    toast.message("Checking payment status…");
    try {
      const status = await MpesaService.getPaymentStatus(checkoutId);
      if (status === "completed") {
        setReceipt(`T${makeTicketId()}K`);
        setSubmitted(true);
        setPayModalStep("closed");
        toast.success("Payment confirmed!");
      } else if (status === "failed") {
        toast.error("Payment was not completed.");
      } else {
        toast.message("Still processing. Please wait a moment and try again.");
      }
    } catch {
      toast.error("Could not check status. Please try again.");
    }
  };

  const download = async () => {
    setDownloading(true);
    try {
      await downloadTickets({
        name: buyer.name || "Attendee",
        poster: eventArt.url,
        venue: "Nyayo Stadium",
        tickets,
      });
    } finally {
      setDownloading(false);
    }
  };

  /* ── SUCCESS SCREEN ─────────────────────────────────────────────────── */
  if (submitted) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <SiteHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} onHome={onBack} />
        <section className="mx-auto max-w-2xl px-4 py-14 text-center">
          <span className="mx-auto grid size-20 place-items-center rounded-full bg-success/15 text-success">
            <Check className="size-10" />
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold">Payment successful</h1>
          <p className="mt-3 text-lg text-muted-foreground">
            M-Pesa confirmed Ksh. {total.toLocaleString()} from {modalPhone}. Receipt <strong className="text-foreground">{receipt}</strong>.
          </p>
          <div className="mt-8 space-y-3 rounded-2xl border border-border bg-panel p-5 text-left">
            {tickets.map((t) => (
              <div key={t.id} className="flex items-center gap-4 border-b border-border pb-3 last:border-0 last:pb-0">
                <img src={eventArt.url} alt="" className="size-14 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{t.type}</p>
                  <p className="text-sm text-muted-foreground">
                    {t.day} · ID {t.id}
                  </p>
                </div>
                <Ticket className="size-5 text-warm" />
              </div>
            ))}
            {added.length > 0 && (
              <p className="pt-2 text-sm text-muted-foreground">
                Merch ({added.length}) — collect at the merch counter on match day.
              </p>
            )}
          </div>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            {tickets.length > 0 && (
              <Button variant="ticket" size="pill" onClick={download} disabled={downloading}>
                {downloading ? <Loader2 className="animate-spin" /> : <Download />} Download PDF ticket{tickets.length > 1 ? "s" : ""}
              </Button>
            )}
            <Button variant="secondary" size="pill" onClick={onBack}>
              Back to event
            </Button>
          </div>
        </section>
      </main>
    );
  }

  /* ── CHECKOUT FORM ──────────────────────────────────────────────────── */
  return (
    <main className="min-h-screen bg-background text-foreground">
      <SiteHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen} onHome={onBack} />
      <div className="mx-auto flex max-w-xl items-center justify-center px-4 py-8 sm:py-10">
        {["Details", "Payment", "Confirm"].map((step, i) => (
          <div key={step} className="flex items-start">
            <div className="flex flex-col items-center">
              <span
                className={`grid size-10 place-items-center rounded-full text-sm font-bold ${
                  i < 2 ? "bg-ticket" : "bg-panel text-muted-foreground"
                }`}
              >
                {i < 2 ? <Check className="size-5" /> : 3}
              </span>
              <span className="mt-2 text-sm font-semibold">{step}</span>
            </div>
            {i < 2 && <span className={`mt-5 h-px w-16 sm:w-28 ${i === 0 ? "bg-ticket" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <div className="mx-auto grid max-w-[1450px] items-start gap-7 px-4 pb-16 lg:grid-cols-[minmax(360px,0.72fr)_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-2xl border border-border bg-panel/50 p-5 sm:p-7 lg:sticky lg:top-28">
          <h1 className="title-rule text-4xl font-bold">Order Summary</h1>
          <div className="mt-7 rounded-xl bg-panel p-4 sm:p-6">
            <div className="space-y-5">
              {ticketGroups.map((ticket, i) => {
                const quantity = counts[i] ?? 0;
                return quantity > 0 ? (
                  <div key={ticket.day} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-start gap-4 border-b border-border pb-5">
                    <img src={eventArt.url} alt="Safari 7s" className="size-16 rounded-lg object-cover" />
                    <div className="min-w-0">
                      <p className="font-bold sm:text-lg">
                        {ticket.name} (Ksh. {ticket.price.toLocaleString()})
                      </p>
                      <p className="text-sm text-muted-foreground">Quantity: {quantity} Ticket(s)</p>
                      <p className="text-sm text-warm">{ticket.day}</p>
                    </div>
                    <p className="shrink-0 font-bold sm:text-lg">Ksh. {(ticket.price * quantity).toLocaleString()}</p>
                  </div>
                ) : null;
              })}
            </div>
            {added.length > 0 && (
              <div className="border-b border-border py-5">
                <h2 className="text-lg font-bold">Merch</h2>
                <p className="mb-3 text-sm text-muted-foreground">Collect at the merch counter on the day.</p>
                {merch.map((item) =>
                  added.includes(item.name) ? (
                    <div key={item.name} className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-4 py-2">
                      <img src={item.image} alt={item.name} className="size-16 rounded-lg bg-background object-cover" />
                      <div className="min-w-0">
                        <p className="font-bold">
                          {item.name} ({selectedSizes[item.name]})
                        </p>
                        <p className="text-sm text-muted-foreground">Quantity: 1</p>
                      </div>
                      <p className="shrink-0 font-bold">Ksh. {MERCH_PRICE.toLocaleString()}</p>
                    </div>
                  ) : null
                )}
              </div>
            )}
            <div className="flex items-center justify-between pt-5 text-xl font-bold sm:text-2xl">
              <span>Total:</span>
              <span>Ksh. {total.toLocaleString()}</span>
            </div>
          </div>
        </aside>

        <form
          className="space-y-7"
          onSubmit={(event) => {
            event.preventDefault();
            if (agreed) openMpesaModal();
          }}
        >
          <section className="rounded-2xl border border-border bg-panel/50 p-5 sm:p-7">
            <h2 className="title-rule text-4xl font-bold">Your Details</h2>
            <p className="mt-4 text-muted-foreground">Please fill in your information to complete the purchase</p>
            <div className="mt-7 space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Full name <b className="text-destructive">*</b>
                </span>
                <input
                  required
                  name="name"
                  value={buyer.name}
                  onChange={(e) => setBuyer((b) => ({ ...b, name: e.target.value }))}
                  className="h-14 w-full rounded-xl border border-input bg-background px-5 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your full name"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Email address <b className="text-destructive">*</b>
                </span>
                <input
                  required
                  type="email"
                  name="email"
                  value={buyer.email}
                  onChange={(e) => setBuyer((b) => ({ ...b, email: e.target.value }))}
                  className="h-14 w-full rounded-xl border border-input bg-background px-5 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your email address"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Phone number <b className="text-destructive">*</b>
                </span>
                <input
                  required
                  type="tel"
                  name="phone"
                  value={buyer.phone}
                  onChange={(e) => {
                    const val = e.target.value;
                    setBuyer((b) => ({ ...b, phone: val }));
                    setModalPhone(val);
                  }}
                  className="h-14 w-full rounded-xl border border-input bg-background px-5 outline-none focus:ring-2 focus:ring-ring"
                  placeholder="0712345678 or +254..."
                />
                <small className="mt-2 block text-muted-foreground">Your M-Pesa number. STK push will be sent to this number.</small>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">Discount code</span>
                <span className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <input name="discount" className="h-14 min-w-0 rounded-xl border border-input bg-background px-5 outline-none focus:ring-2 focus:ring-ring" placeholder="Enter discount code (optional)" />
                  <Button type="button" variant="secondary" className="h-14 px-6">
                    Apply
                  </Button>
                </span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold uppercase tracking-[0.16em] text-muted-foreground">Promo code</span>
                <span className="relative block">
                  <BadgePercent className="absolute left-5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <input name="promo" className="h-14 w-full rounded-xl border border-input bg-background pl-14 pr-5 outline-none focus:ring-2 focus:ring-ring" placeholder="Bought through an agent? Enter their code" />
                </span>
                <small className="mt-2 block text-muted-foreground">Optional credits the sale to your agent. It doesn't change your total.</small>
              </label>
              <label className="flex cursor-pointer items-center gap-3 text-base">
                <input required type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} className="size-5 accent-[var(--ticket-strong)]" />
                <span>
                  I agree to the <strong className="text-warm">Terms and Conditions</strong>
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-panel/50 p-5 sm:p-7">
            <h2 className="title-rule text-4xl font-bold">Payment Method</h2>
            <div className="mt-7">
              <label className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-emerald-500 bg-emerald-500/10 p-5 transition">
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-white p-1.5 shadow-sm border border-emerald-200">
                  <img src="/images/mpesa-logo.png" alt="M-Pesa" className="h-full w-full object-contain" />
                </div>
                <div>
                  <strong className="block text-lg">M-Pesa STK Push</strong>
                  <span className="text-sm text-muted-foreground">Instant M-Pesa prompt on your phone</span>
                </div>
                <span className="grid size-8 place-items-center rounded-full bg-emerald-500 text-white">
                  <Check className="size-5" />
                </span>
              </label>
            </div>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" size="pill" onClick={onBack}>
                <ArrowLeft /> Back
              </Button>
              <Button type="submit" variant="ticket" size="pill">
                Pay Ksh. {total.toLocaleString()} <ArrowRight />
              </Button>
            </div>
          </section>
        </form>
      </div>

      {/* ── M-PESA MODAL (EXACT WORKFLOW FROM SURVAYROGUE) ───────────────── */}
      {payModalStep !== "closed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/70 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="bg-card text-card-foreground rounded-3xl w-full max-w-md shadow-2xl border border-border overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 p-6 text-white">
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-16 rounded-xl bg-white p-1 flex items-center justify-center shadow-md shrink-0">
                    <img src="/images/mpesa-logo.png" alt="M-Pesa" className="h-full w-full object-contain" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold text-lg">M-Pesa Payment</h3>
                    <p className="text-white/80 text-xs">Safari 7s 2026 Rugby Tickets</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPayModalStep("closed")}
                  disabled={payModalStep === "processing"}
                  className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors disabled:opacity-30 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Step 1: Phone input */}
              {payModalStep === "phone" && (
                <div className="space-y-4">
                  <div className="text-center mb-4">
                    <div className="w-24 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center bg-white p-2 shadow-lg border border-border">
                      <img src="/images/mpesa-logo.png" alt="M-Pesa" className="h-full w-full object-contain" />
                    </div>
                    <h4 className="font-heading font-bold text-lg mb-1">Enter M-Pesa Phone Number</h4>
                    <p className="text-xs text-muted-foreground">
                      Pay <span className="font-bold text-emerald-600 dark:text-emerald-400">Ksh. {total.toLocaleString()}</span> for your tickets
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">
                      M-Pesa Phone Number
                    </label>
                    <div className="relative">
                      <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <input
                        type="tel"
                        autoFocus
                        value={modalPhone}
                        onChange={(e) => setModalPhone(e.target.value)}
                        placeholder="+254 7XX XXX XXX or 07XXXXXXXX"
                        className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-secondary border border-border text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                        onKeyDown={(e) => e.key === "Enter" && handleSendSTK()}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5">
                      You will receive an STK push notification on this number
                    </p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPayModalStep("closed")}
                      className="flex-1 py-3.5 rounded-xl border-2 border-border text-sm font-semibold hover:bg-secondary transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSendSTK}
                      disabled={isSending || modalPhone.replace(/\D/g, "").length < 9}
                      className="flex-[2] py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/25 hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        <>
                          <Smartphone className="w-4 h-4" />
                          Send STK Push
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Processing loader */}
              {payModalStep === "processing" && (
                <div className="text-center py-6">
                  <div className="relative w-28 h-20 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 animate-ping opacity-20" />
                    <div className="relative w-28 h-20 rounded-2xl bg-white p-2 shadow-lg border border-emerald-200 flex flex-col items-center justify-center">
                      <img src="/images/mpesa-logo.png" alt="M-Pesa" className="h-9 w-full object-contain mb-1" />
                      <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Prompting phone…</span>
                      </div>
                    </div>
                  </div>

                  <h4 className="font-heading font-bold text-xl mb-2">Processing Payment</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Please check your phone (<strong className="text-foreground">{modalPhone}</strong>) and enter your M-Pesa PIN to complete payment of <strong className="text-foreground">Ksh. {total.toLocaleString()}</strong>.
                  </p>

                  <div className="flex items-center justify-center gap-1.5 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0.1s" }} />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: "0.2s" }} />
                  </div>

                  <p className="text-xs text-muted-foreground mb-4">
                    Do not close this page. Verifying payment… ({pollAttempt}/24)
                  </p>

                  <button
                    type="button"
                    onClick={manualCheck}
                    className="text-xs text-muted-foreground hover:text-foreground underline cursor-pointer"
                  >
                    I have already entered my PIN
                  </button>
                </div>
              )}

              {/* Step 3: Failed / Timeout */}
              {payModalStep === "failed" && (
                <div className="text-center py-4 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-destructive/15 text-destructive grid place-items-center mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h4 className="font-heading font-bold text-lg">Payment Status</h4>
                  <p className="text-sm text-muted-foreground px-2">
                    {errorMsg || "Payment was not completed. Please try again."}
                  </p>

                  <div className="space-y-2.5 pt-2">
                    {checkoutId && (
                      <button
                        type="button"
                        onClick={manualCheck}
                        className="w-full py-3.5 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition shadow-md cursor-pointer"
                      >
                        I Have Already Paid (Check Status)
                      </button>
                    )}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setPayModalStep("phone")}
                        className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-sm hover:opacity-90 transition cursor-pointer"
                      >
                        Change Number / Try Again
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayModalStep("closed")}
                        className="py-3 px-5 rounded-xl border border-border text-sm font-medium hover:bg-secondary transition cursor-pointer"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function SafariEvent() {
  const [counts, setCounts] = useState([0, 0, 0, 0]);
  const [liked, setLiked] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [checkoutOpen]);
  const ticketTotal = useMemo(() => counts.reduce((sum, count, i) => sum + count * (ticketGroups[i]?.price ?? 0), 0), [counts]);
  const total = ticketTotal + added.length * MERCH_PRICE;
  const itemCount = counts.reduce((sum, count) => sum + count, 0) + added.length;
  const adjust = (i: number, amount: number) => setCounts((current) => current.map((n, j) => j === i ? Math.max(0, Math.min(10, n + amount)) : n));

  if (checkoutOpen) return <CheckoutPage counts={counts} added={added} selectedSizes={selectedSizes} total={total} onBack={() => setCheckoutOpen(false)}/>;

  return (
    <main id="top" className="min-h-screen bg-background text-foreground">
      <SiteHeader menuOpen={menuOpen} setMenuOpen={setMenuOpen}/>

      <section className="mx-auto grid max-w-[1380px] gap-10 px-4 py-10 md:px-8 lg:grid-cols-[370px_minmax(0,1fr)] lg:gap-16 lg:py-12">
        <aside>
          <div className="group relative overflow-hidden rounded-[20px]"><img src={eventArt.url} alt="Safari 7s 2026 event poster" className="aspect-square w-full object-cover transition duration-500 group-hover:scale-[1.02]"/><div className="absolute bottom-4 right-4 flex gap-2"><Button size="icon" variant="secondary" className="rounded-full bg-background/85" aria-label="Save event" onClick={() => setLiked(!liked)}><Heart className={liked ? "fill-destructive text-destructive" : ""}/></Button><Button size="icon" variant="secondary" className="rounded-full bg-background/85" aria-label="Share event" onClick={() => navigator.clipboard?.writeText(window.location.href)}><Share2/></Button></div></div>
          <div id="about" className="scroll-mt-28 pt-7"><h2 className="font-display text-4xl font-bold">About</h2><p className="mt-4 max-w-sm text-lg leading-relaxed text-muted-foreground">Experience three days of thrilling rugby, unforgettable entertainment, and an electric atmosphere at Nyayo Stadium from 9–11 October 2026.</p><a href="#details" className="mt-3 inline-block border-b border-foreground font-semibold">Read more</a></div>
        </aside>

        <div className="min-w-0">
          <div id="details" className="scroll-mt-28"><span className="inline-flex rounded-full bg-ticket px-4 py-1 text-xs font-bold uppercase text-ticket-foreground">TikoHUB presents</span><h1 className="mt-4 font-display text-6xl font-bold uppercase leading-none sm:text-7xl lg:text-8xl">Safari 7s 2026</h1><h2 className="mt-7 text-3xl font-bold sm:text-4xl">Nyayo Stadium</h2><div className="mt-6 flex flex-wrap gap-3"><span className="inline-flex items-center gap-2 rounded-full bg-panel px-4 py-2"><Ticket className="size-4"/> Sports</span><span className="inline-flex items-center gap-2 rounded-full bg-panel px-4 py-2"><MapPin className="size-4 text-warm"/> Nairobi</span></div></div>

          <section id="tickets" className="mt-10 scroll-mt-28 rounded-2xl border border-border bg-panel p-5 sm:p-8">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4"><h2 className="text-3xl font-bold sm:text-4xl">From 300 Ksh.</h2><span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">4 ticket types</span></div>
            <div className="mt-6 divide-y divide-border">
              {ticketGroups.map((ticket, i) => <div key={ticket.day} className="py-5"><p className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-warm"><CalendarDays className="size-4"/>{ticket.day}</p><div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg bg-background/60 p-4"><div className="min-w-0"><h3 className="font-bold sm:text-lg">{ticket.name} (Ksh. {ticket.price.toLocaleString()})</h3><p className="mt-1">Ksh. {ticket.price.toLocaleString()}</p></div><div className="flex shrink-0 items-center gap-2 sm:gap-4"><Button size="icon" variant="outline" className="rounded-full" aria-label={`Remove ${ticket.name}`} disabled={!counts[i]} onClick={() => adjust(i, -1)}><Minus/></Button><output className="w-4 text-center font-bold">{counts[i]}</output><Button size="icon" variant="outline" className="rounded-full" aria-label={`Add ${ticket.name}`} onClick={() => adjust(i, 1)}><Plus/></Button></div></div></div>)}
            </div>
            <div className="mt-5 border-t border-border pt-6"><p className="text-sm text-muted-foreground">{counts.reduce((a,b) => a+b,0)} tickets selected</p><p className="text-2xl font-bold">Ksh. {ticketTotal.toLocaleString()}</p></div>
          </section>

          <section id="merch" className="mt-10 scroll-mt-28 border-t border-border pt-8"><div className="flex items-start gap-4"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-ticket/20 text-warm"><ShoppingCart className="size-5"/></span><div><h2 className="text-2xl font-bold">Merch</h2><p className="text-muted-foreground">Pay for it with your tickets and collect it at the merch counter on the day.</p></div></div><div className="mt-6 grid gap-4 md:grid-cols-2">{merch.map(({ name, image, sizes }) => <article key={name} className="rounded-xl border border-border bg-panel p-5"><div className="flex gap-4"><img src={image} alt={name} className="size-24 shrink-0 rounded-lg bg-background object-cover"/><div className="min-w-0"><h3 className="font-bold">{name}</h3><p className="mt-1 text-lg font-bold text-success">Ksh. {MERCH_PRICE.toLocaleString()}</p><div className="mt-3 flex flex-wrap gap-2" aria-label={`Choose size for ${name}`}>{sizes.split(" ").map((size) => <Button key={size} type="button" size="sm" variant={selectedSizes[name] === size ? "ticket" : "outline"} className="h-7 min-w-9 rounded-full px-2" onClick={() => setSelectedSizes((current) => ({ ...current, [name]: size }))}>{size}</Button>)}</div><Button variant="ticket" className="mt-4 rounded-full" disabled={!selectedSizes[name] && !added.includes(name)} onClick={() => setAdded((items) => items.includes(name) ? items.filter((item) => item !== name) : [...items, name])}>{added.includes(name) ? <Check/> : <Plus/>}{added.includes(name) ? "Added" : "Add"}</Button></div></div></article>)}</div>
            <div className="mt-8 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-xl border border-border bg-panel p-5 sm:p-6"><div><p className="text-sm text-muted-foreground">{itemCount} {itemCount === 1 ? "item" : "items"} selected</p><p className="text-2xl font-bold">Total · Ksh. {total.toLocaleString()}</p>{added.length > 0 && <p className="mt-1 text-sm text-muted-foreground">Includes {added.length} {added.length === 1 ? "jersey" : "jerseys"}</p>}</div><Button variant="ticket" size="pill" disabled={!total} onClick={() => setCheckoutOpen(true)}>Continue <span aria-hidden>→</span></Button></div>
          </section>

          <section id="checkout" className="mt-10 scroll-mt-28 border-t border-border py-10"><p className="text-sm font-bold uppercase tracking-[0.18em] text-muted-foreground">Venue</p><h2 className="mt-2 font-display text-5xl font-bold">Nyayo Stadium</h2><p className="mt-2 text-lg">Nairobi</p><div className="mt-6 flex flex-wrap gap-3"><Button variant="ticket" size="pill" asChild><a href="https://maps.google.com/?q=Nyayo+Stadium+Nairobi" target="_blank" rel="noreferrer"><MapPinned/> Open in maps</a></Button><Button variant="outline" size="pill">Follow</Button></div><p className="mt-7 flex items-center gap-2"><Ticket className="size-4 text-warm"/> Doors Open 7:30 AM</p></section>
        </div>
      </section>
      <footer className="border-t border-border py-10"><div className="mx-auto grid max-w-[1380px] gap-8 px-4 md:grid-cols-4 md:px-8"><div><Brand/><p className="mt-4 text-sm text-muted-foreground">Make every day an adventure with TikoHUB.</p></div><div><h3 className="font-bold">Top cities</h3><p className="mt-3 text-muted-foreground">Nairobi · Mombasa · Kampala</p></div><div><h3 className="font-bold">By type</h3><p className="mt-3 text-muted-foreground">Concerts · Comedy · Sports</p></div><div><h3 className="font-bold">Support</h3><p className="mt-3 text-muted-foreground">Contact us · Privacy · FAQs</p></div></div></footer>
    </main>
  );
}