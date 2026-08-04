/**
 * Vodium Ledger — speech-to-text for Nigerian languages (Spitch).
 *
 * Why a separate provider: Claude has no audio input, so a voice note has to be
 * turned into text before the AI layer can read it. Spitch is used rather than
 * Whisper because Igbo is absent from Whisper's vocabulary entirely and it
 * hallucinates text on silence — two failure modes we cannot ship to vendors.
 *
 * IMPORTANT — Spitch does NOT return a detected language. Its response carries
 * only { text, segments, request_id }. Transcription accuracy therefore depends
 * on passing the right `language` up front, which is why the vendor's language
 * is stored on their record (Vendor.voiceLanguage) and passed in on every call
 * instead of being guessed per message.
 *
 * Like ai.ts and ocr.ts, everything degrades to null when SPITCH_API_KEY is
 * unset. A null result means "could not transcribe" — never treat it as an
 * error; the caller falls back to asking the vendor to type instead.
 */

import Spitch, { toFile } from "spitch";

/**
 * Languages we transcribe. Spitch takes ISO-639 codes; these four cover the
 * campus-vendor population (Nigerian-accented English included, because most
 * vendors code-switch mid-sentence rather than speaking one language purely).
 */
export const VOICE_LANGUAGES = ["yo", "ig", "ha", "en"] as const;
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number];

export function isVoiceLanguage(value: string): value is VoiceLanguage {
  return (VOICE_LANGUAGES as readonly string[]).includes(value);
}

/** Human labels for bot copy and dashboard display. */
export const VOICE_LANGUAGE_LABELS: Record<VoiceLanguage, string> = {
  yo: "Yorùbá",
  ig: "Igbo",
  ha: "Hausa",
  en: "English",
};

/**
 * WhatsApp sends voice notes as OGG/Opus. Spitch accepts raw file bytes, so no
 * transcoding is needed — but the filename extension is the only format hint it
 * gets, so it has to match the mime type we were actually sent.
 */
const MIME_EXTENSIONS: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp4": "mp4",
  "audio/aac": "aac",
  "audio/amr": "amr",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
};

/**
 * Meta reports mime types with codec parameters attached
 * ("audio/ogg; codecs=opus"), which no lookup table will match — strip them.
 */
function extensionFor(mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return MIME_EXTENSIONS[base] ?? "ogg";
}

/** Longest note we will transcribe. Vendors speak for seconds, not minutes. */
const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // matches the WhatsApp media download cap

/**
 * Built on first use, never at module load.
 *
 * The Spitch constructor THROWS when no API key is present, so constructing it
 * at import time takes the whole WhatsApp webhook route down with it whenever
 * SPITCH_API_KEY is unset — which is exactly the "degrade to null" case this
 * module promises to survive, and which is the norm locally and at build time.
 */
let client: Spitch | null = null;

function getClient(): Spitch | null {
  const apiKey = process.env.SPITCH_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Spitch({ apiKey });
  return client;
}

function enabled(): boolean {
  return Boolean(process.env.SPITCH_API_KEY);
}

export interface TranscriptionResult {
  /** What the vendor said, in the language they said it. */
  text: string;
  /** The language we asked Spitch to assume — NOT a detected value. */
  language: VoiceLanguage;
  /** Spitch's own id, kept for support tickets about a bad transcription. */
  requestId?: string;
}

/**
 * Transcribe a voice note.
 *
 * Returns null when ASR is unavailable or produced nothing usable, so the
 * caller can fall back to asking the vendor to type the credit instead.
 */
export async function transcribeVoiceNote(input: {
  audio: Buffer;
  mimeType: string;
  /** The vendor's stored language. Accuracy depends on this being right. */
  language: VoiceLanguage;
}): Promise<TranscriptionResult | null> {
  if (!enabled()) {
    console.log("[asr] SPITCH_API_KEY not configured; cannot transcribe");
    return null;
  }

  const spitch = getClient();
  if (!spitch) return null;

  if (input.audio.byteLength > MAX_AUDIO_BYTES) {
    console.warn(`[asr] audio is ${input.audio.byteLength} bytes — over the ${MAX_AUDIO_BYTES} limit`);
    return null;
  }

  try {
    const file = await toFile(input.audio, `voice-note.${extensionFor(input.mimeType)}`, {
      type: input.mimeType.split(";")[0].trim(),
    });

    const transcription = await spitch.speech.transcribe({
      content: file,
      language: input.language,
    });

    const text = transcription.text?.trim();
    if (!text) {
      console.log(`[asr] empty transcript for ${input.language} note`);
      return null;
    }

    return { text, language: input.language, requestId: transcription.request_id };
  } catch (err) {
    console.warn("[asr] transcribeVoiceNote failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
