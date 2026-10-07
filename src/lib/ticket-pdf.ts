import { jsPDF } from "jspdf";
import QRCode from "qrcode";

export type TicketLine = { type: string; price: number; day: string; id: string };

const TERMS = [
  "This ticket is non-transferable and can only be used by or together with the person whose name appears on the ticket.",
  "The organizer may reschedule or cancel the event due to unforeseen circumstances beyond their control, such as natural disasters, war, strikes, or government restrictions, with no obligation for a refund.",
  "The organizer is not liable for personal injury, loss, or property damage during the event.",
  "By attending, you consent to being photographed and recorded for promotional purposes.",
  "The organizer reserves the right to remove attendees who do not comply with event rules or engage in disruptive or inappropriate behavior, without a refund.",
  "No refunds or exchanges will be provided except at the organizer's sole discretion.",
];

export function makeTicketId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

async function toDataUrl(url: string) {
  const blob = await (await fetch(url)).blob();
  return new Promise<string>((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

export async function downloadTickets(opts: { name: string; poster: string; venue: string; tickets: TicketLine[] }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 48;
  const poster = await toDataUrl(opts.poster);

  for (let i = 0; i < opts.tickets.length; i++) {
    const t = opts.tickets[i]!;
    if (i > 0) doc.addPage();
    let y = M;
    const pw = W - M * 2;
    const ps = 380;
    doc.addImage(poster, "JPEG", M, y, ps, ps, undefined, "FAST");
    y += ps + 14;
    const qr = await QRCode.toDataURL(`TIKOHUB|SAFARI7S2026|${t.id}|${opts.name}`, { margin: 0, width: 300 });
    doc.addImage(qr, "PNG", M, y, 100, 100);
    y += 116;

    const row = (label: string, value: string) => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(0);
      doc.text(label, M, y);
      doc.setFont("helvetica", "normal");
      doc.text(value, M + doc.getTextWidth(label) + 4, y);
      y += 19;
    };
    row("Name:", opts.name);
    row("Allows:", "1");
    row("Ticket Type:", `${t.type} (Ksh. ${t.price.toLocaleString()})`);
    row("Day:", t.day);
    row("Ticket ID:", t.id);
    row("Venue:", opts.venue);

    y += 2;
    doc.setLineDashPattern([1, 2], 0); doc.setDrawColor(150);
    doc.line(M, y, W - M, y);
    doc.setLineDashPattern([], 0);
    y += 18;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("Terms and Conditions:", M, y);
    y += 14;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    TERMS.forEach((term, n) => {
      const lines = doc.splitTextToSize(term, pw - 14) as string[];
      doc.text(`${n + 1}.`, M, y);
      doc.text(lines, M + 12, y);
      y += lines.length * 10 + 3;
    });
  }
  doc.save(`Safari7s-2026-tickets-${opts.name.replace(/\s+/g, "-")}.pdf`);
}
