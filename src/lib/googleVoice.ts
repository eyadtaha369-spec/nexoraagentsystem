/** Builds a Google Voice "click to call" URL for a phone number.
 * Opening this (in a browser where you're signed into Google Voice) starts
 * an outbound call from your Google Voice number.
 */
export function googleVoiceCallUrl(rawPhone: string): string {
  let digits = (rawPhone || "").replace(/[^\d+]/g, "");
  if (!digits) return "https://voice.google.com/u/0/calls";

  if (digits.startsWith("+")) {
    // already has a country code
  } else if (digits.length === 10) {
    // bare US/Canada number, e.g. 5551234567
    digits = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith("1")) {
    digits = `+${digits}`;
  } else {
    // unknown format — pass through with a leading + and let Google Voice
    // interpret it rather than guessing a country code that might be wrong
    digits = `+${digits.replace(/^\+/, "")}`;
  }

  return `https://voice.google.com/u/0/calls?a=nc,${encodeURIComponent(digits)}`;
}

export function callViaGoogleVoice(rawPhone: string) {
  window.open(googleVoiceCallUrl(rawPhone), "_blank", "noopener,noreferrer");
}
