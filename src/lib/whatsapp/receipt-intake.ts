/**
 * Vodium Ledger — "customer sent a photo of their transfer receipt".
 *
 * This is the highest-value OCR path: today a customer pays by bank transfer,
 * screenshots the receipt, and sends it to the vendor on WhatsApp — and a human
 * reads it and types the repayment in by hand. This module reads it instead.
 *
 * SAFETY MODEL — this is the important part:
 * A receipt is a CLAIM, never proof. Anyone can send a screenshot, edit one, or
 * resend the same one twice. So OCR NEVER marks a credit paid. It does exactly
 * what a "PAID" reply already does — raise a claim the vendor must confirm —
 * only now the vendor sees the amount, bank, and reference already extracted,
 * so confirming takes one tap instead of an interrogation.
 *
 * Low-confidence or failed-looking receipts are deliberately NOT auto-matched;
 * the customer is asked to resend or type the amount, because a wrongly matched
 * repayment silently erases a real debt from a vendor's ledger.
 */

import { prisma } from "@/lib/prisma";
import { formatNaira } from "@/lib/utils";
import { extractPaymentReceipt, isVisionMediaType, type PaymentReceipt } from "@/lib/ocr";
import { downloadWhatsAppMedia } from "@/lib/whatsapp/media";
import { sendWhatsAppButtons, sendWhatsAppMessage } from "@/lib/whatsapp/outbound";
import { getOrgChannelCredentials } from "@/lib/whatsapp/channel-token";

/** Credit states a payment can still apply to. */
const OPEN_STATUSES = ["OUTSTANDING", "DUE_SOON", "OVERDUE"] as const;

/** Treat amounts within this margin as matching, to absorb OCR rounding. */
const AMOUNT_TOLERANCE = 1;

export interface ReceiptHandlingResult {
  handled: boolean;
  reason?: string;
}

/**
 * Handle an inbound image from a customer.
 *
 * Returns handled=false when this isn't something we should act on (no open
 * credit, OCR unavailable), so the caller can fall through to its normal flow.
 */
export async function handleIncomingReceipt(input: {
  fromPhone: string;
  mediaId: string;
  mimeType?: string;
  creds?: { token: string; phoneId: string };
}): Promise<ReceiptHandlingResult> {
  const { fromPhone, mediaId, creds } = input;

  // Only act for a customer who actually owes something — otherwise a random
  // photo would trigger a payment conversation out of nowhere.
  const student = await prisma.student.findUnique({ where: { phone: fromPhone } });
  if (!student) return { handled: false, reason: "not a known customer" };

  const credits = await prisma.credit.findMany({
    where: { studentId: student.id, status: { in: [...OPEN_STATUSES] } },
    include: {
      vendor: {
        select: {
          id: true,
          businessName: true,
          phone: true,
          organizationId: true,
          bankAccountName: true,
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });
  if (!credits.length) return { handled: false, reason: "no open credit" };

  const media = await downloadWhatsAppMedia(mediaId, creds);
  if (!media) {
    await sendWhatsAppMessage(
      fromPhone,
      "I could not open that image. Please send the receipt again, or reply with the amount you paid.",
      creds,
    );
    return { handled: true, reason: "media download failed" };
  }

  if (!isVisionMediaType(media.mimeType)) {
    await sendWhatsAppMessage(
      fromPhone,
      "I can only read photos and screenshots. Please send the receipt as an image, " +
        "or reply with the amount you paid.",
      creds,
    );
    return { handled: true, reason: `unsupported media type ${media.mimeType}` };
  }

  const receipt = await extractPaymentReceipt({
    imageBase64: media.base64,
    mediaType: media.mimeType,
    expectedRecipient: credits[0].vendor.bankAccountName ?? undefined,
  });

  // OCR unavailable (no API key) — say nothing clever, just fall through so the
  // customer can still use the normal PAID flow.
  if (!receipt) return { handled: false, reason: "ocr unavailable" };

  if (receipt.looksFailed) {
    await sendWhatsAppMessage(
      fromPhone,
      "That receipt looks like the transfer did not go through. Please check with your bank and " +
        "send the successful receipt when you have it.",
      creds,
    );
    return { handled: true, reason: "receipt shows failed transfer" };
  }

  if (receipt.confidence === "low" || receipt.amount <= 0) {
    await sendWhatsAppButtons(
      fromPhone,
      "I could not read that receipt clearly. You can send a sharper photo, or tell your vendor " +
        "directly that you have paid.",
      [{ id: "CLAIM_PAID", title: "I paid my debt" }],
      creds,
    );
    return { handled: true, reason: "low confidence read" };
  }

  // Duplicate guard: the same transaction reference must not raise a second
  // claim, or a customer resending a screenshot looks like two payments.
  if (receipt.reference) {
    const seen = await prisma.notification.findFirst({
      where: {
        type: "INFO",
        title: "Payment Receipt",
        message: { contains: receipt.reference },
      },
      select: { id: true },
    });
    if (seen) {
      await sendWhatsAppMessage(
        fromPhone,
        `I already have that receipt (ref ${receipt.reference}). Your vendor has been notified — ` +
          "please wait for them to confirm.",
        creds,
      );
      return { handled: true, reason: "duplicate reference" };
    }
  }

  // Match the receipt to a specific credit where we safely can: an exact amount
  // match is unambiguous. Otherwise raise the claim against the oldest debt and
  // let the vendor decide.
  const exact = credits.find(
    (c) => Math.abs(Number(c.amount) - receipt.amount) <= AMOUNT_TOLERANCE,
  );
  const target = exact ?? credits[0];
  const targetAmount = Number(target.amount);

  await notifyVendorOfReceipt({ receipt, student, target, targetAmount, matchedExactly: Boolean(exact) });

  // Acknowledge to the customer — honest about it being pending, never implying
  // the debt is cleared.
  const ackAmount = formatNaira(receipt.amount);
  await sendWhatsAppMessage(
    fromPhone,
    `Thank you. I have read your receipt for *${ackAmount}*` +
      (receipt.bankName ? ` from ${receipt.bankName}` : "") +
      `.\n\nI have sent it to *${target.vendor.businessName}* to confirm. ` +
      "Your record updates as soon as they do.",
    creds,
  );

  return { handled: true, reason: exact ? "matched exactly" : "raised against oldest credit" };
}

/** Send the vendor a one-tap confirm/reject with the extracted details. */
async function notifyVendorOfReceipt(args: {
  receipt: PaymentReceipt;
  student: { id: string; fullName: string };
  target: {
    id: string;
    vendor: { id: string; businessName: string; phone: string; organizationId: string | null };
  };
  targetAmount: number;
  matchedExactly: boolean;
}): Promise<void> {
  const { receipt, student, target, targetAmount, matchedExactly } = args;

  const detailLines = [
    `*${student.fullName}* sent a payment receipt.`,
    "",
    `Amount on receipt: *${formatNaira(receipt.amount)}*`,
    `Amount owing: ${formatNaira(targetAmount)}`,
    ...(receipt.bankName ? [`Bank: ${receipt.bankName}`] : []),
    ...(receipt.senderName ? [`Sender: ${receipt.senderName}`] : []),
    ...(receipt.paidAt ? [`Date: ${receipt.paidAt}`] : []),
    ...(receipt.reference ? [`Ref: ${receipt.reference}`] : []),
    "",
    matchedExactly
      ? "The amount matches this debt exactly."
      : "⚠️ The amount does not match exactly — please check before confirming.",
    "",
    "Only confirm after you have seen the money in your account.",
  ];

  await prisma.notification.create({
    data: {
      vendorId: target.vendor.id,
      title: "Payment Receipt",
      message:
        `${student.fullName} sent a receipt for ₦${receipt.amount.toLocaleString()}` +
        (receipt.reference ? ` (ref ${receipt.reference})` : "") +
        ". Confirm once the money lands.",
      type: "INFO",
    },
  });

  const vendorCreds = (await getOrgChannelCredentials(target.vendor.organizationId)) ?? undefined;
  try {
    await sendWhatsAppButtons(
      target.vendor.phone,
      detailLines.join("\n"),
      [
        { id: `CONFIRM_PAID_${target.id}`, title: "Confirm received ✓" },
        { id: `NOT_PAID_${target.id}`, title: "Not received" },
      ],
      vendorCreds,
    );
  } catch (err) {
    console.warn(
      `[receipt] could not notify vendor ${target.vendor.phone}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
