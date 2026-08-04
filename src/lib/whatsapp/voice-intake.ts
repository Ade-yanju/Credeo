/**
 * Vodium Ledger — "the vendor sent a voice note instead of typing".
 *
 * Typing is the slowest part of logging a credit, and the vendors we serve talk
 * far faster than they type — often in Yorùbá, Igbo or Hausa. This module turns
 * a voice note into ordinary text and hands it back, so everything downstream
 * (NLU → state machine → AI rescue) stays audio-unaware and keeps working
 * exactly as it does for a typed message.
 *
 * TWO THINGS THIS DELIBERATELY DOES NOT DO:
 *
 * 1. It never acts on a transcript by itself. The caller echoes what was heard
 *    back to the vendor, and the credit still goes through the normal
 *    confirmation step — a misheard "five thousand" must be catchable before it
 *    reaches a ledger.
 * 2. It never guesses the language. Spitch reports no detected language, so
 *    accuracy depends entirely on being told the right one up front (see
 *    asr.ts). The vendor is asked once and the answer is stored on their record.
 */

import { prisma } from "@/lib/prisma";
import { transcribeVoiceNote, isVoiceLanguage, type VoiceLanguage } from "@/lib/asr";
import { downloadWhatsAppMedia } from "@/lib/whatsapp/media";
import { sendWhatsAppList, sendWhatsAppMessage, type WhatsAppListRow } from "@/lib/whatsapp/outbound";
import { VOICE_LANGUAGES, VOICE_LANGUAGE_LABELS } from "@/lib/asr";
import { messages } from "@/lib/whatsapp/messages";

/**
 * Session-context key marking "we have already asked this vendor which language
 * they speak". Kept in the session blob rather than a column because
 * Vendor.voiceLanguage is NOT NULL with a default — it cannot distinguish
 * "chose English" from "never answered", and this flag can.
 */
export const VOICE_LANG_ASKED_KEY = "voiceLangAsked";

/** Button/list id prefix for a language choice, e.g. "SET_LANG_yo". */
export const SET_LANG_PREFIX = "SET_LANG_";

export type VoiceIntakeOutcome =
  /** Transcribed successfully — the caller should process `transcript` as text. */
  | { status: "transcribed"; transcript: string; language: VoiceLanguage }
  /** We have already replied to the vendor; the caller should end the turn. */
  | { status: "replied"; reason: string };

/** The language list, as a tappable WhatsApp list. */
export function voiceLanguageRows(): WhatsAppListRow[] {
  return VOICE_LANGUAGES.map((code) => ({
    id: `${SET_LANG_PREFIX}${code}`,
    title: VOICE_LANGUAGE_LABELS[code],
  }));
}

/** Ask which language this vendor speaks, and remember that we asked. */
export async function askVoiceLanguage(
  fromPhone: string,
  creds?: { token: string; phoneId: string },
): Promise<void> {
  await sendWhatsAppList(
    fromPhone,
    messages.voiceAskLanguage(),
    "Choose language",
    voiceLanguageRows(),
    creds,
  );
}

/**
 * Handle a "SET_LANG_xx" tap. Returns false when `text` isn't one, so the
 * caller can fall through to its normal command handling.
 */
export async function handleVoiceLanguageChoice(input: {
  text: string;
  vendorId: string;
  fromPhone: string;
  creds?: { token: string; phoneId: string };
}): Promise<boolean> {
  const { text, vendorId, fromPhone, creds } = input;
  if (!text.toUpperCase().startsWith(SET_LANG_PREFIX)) return false;

  // Case matters here: the ids are built from lowercase ISO-639 codes, but
  // WhatsApp round-trips the id untouched only for taps — a vendor who *types*
  // "set_lang_YO" should still work.
  const code = text.slice(SET_LANG_PREFIX.length).toLowerCase();
  if (!isVoiceLanguage(code)) return false;

  await prisma.vendor.update({
    where: { id: vendorId },
    data: { voiceLanguage: code },
  });
  await sendWhatsAppMessage(fromPhone, messages.voiceLanguageSaved(VOICE_LANGUAGE_LABELS[code]), creds);
  return true;
}

/**
 * Download and transcribe an inbound voice note.
 *
 * Every failure path replies to the vendor with a way forward (say it again, or
 * type it) and returns "replied" — a voice note must never end in silence.
 */
export async function handleIncomingVoiceNote(input: {
  fromPhone: string;
  mediaId: string;
  vendor: { id: string; voiceLanguage: string };
  /** True once the vendor has been asked which language they speak. */
  languageAsked: boolean;
  creds?: { token: string; phoneId: string };
}): Promise<VoiceIntakeOutcome> {
  const { fromPhone, mediaId, vendor, languageAsked, creds } = input;

  // First voice note ever: ask before transcribing. Guessing here would mean
  // transcribing Yorùbá speech as English, which produces confident nonsense
  // rather than an obvious failure — worse than one extra question.
  if (!languageAsked) {
    await askVoiceLanguage(fromPhone, creds);
    return { status: "replied", reason: "asked for language" };
  }

  const media = await downloadWhatsAppMedia(mediaId, creds);
  if (!media) {
    // downloadWhatsAppMedia returns null for an over-size file as well as a
    // failed fetch, and "that was too long" is the far more likely case for a
    // voice note — it is the one limit a vendor can actually act on.
    await sendWhatsAppMessage(fromPhone, messages.voiceTooLong(), creds);
    return { status: "replied", reason: "media download failed" };
  }

  const language: VoiceLanguage = isVoiceLanguage(vendor.voiceLanguage)
    ? vendor.voiceLanguage
    : "en";

  const result = await transcribeVoiceNote({
    audio: Buffer.from(media.base64, "base64"),
    mimeType: media.mimeType,
    language,
  });

  if (!result) {
    // Null covers both "ASR is switched off" and "nothing usable came back".
    // Only the first is worth a different message, since the vendor should not
    // keep re-recording against a provider that isn't configured.
    const unavailable = !process.env.SPITCH_API_KEY;
    await sendWhatsAppMessage(
      fromPhone,
      unavailable ? messages.voiceUnavailable() : messages.voiceUnclear(),
      creds,
    );
    return { status: "replied", reason: unavailable ? "asr unavailable" : "empty transcript" };
  }

  console.log(`[voice] ${fromPhone} (${language}): "${result.text}"`);
  return { status: "transcribed", transcript: result.text, language };
}
