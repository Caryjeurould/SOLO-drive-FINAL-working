/**
 * Last-resort fallback only — the real Safety/Compliance numbers are managed
 * in the Admin Dashboard (`safety_contact_numbers` table) so staff can change
 * them without a redeploy. This constant only matters if that row is ever
 * unset or unreachable.
 */
export const SAFETY_LINE_PHONE_NUMBER = "281-829-8429";

export function toTelHref(phoneNumber: string): string {
  return `tel:${phoneNumber.replace(/[^0-9+]/g, "")}`;
}

export const SAFETY_LINE_TEL_HREF = toTelHref(SAFETY_LINE_PHONE_NUMBER);
