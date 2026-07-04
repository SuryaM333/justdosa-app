/**
 * Formats and validates Australian mobile phone numbers (04XX XXX XXX)
 */

export function cleanPhoneNumber(input: string): string {
  // Strip all non-digit characters
  let digits = input.replace(/\D/g, '');
  
  // Convert +614 or 614 to 04
  if (digits.startsWith('614') && digits.length === 11) {
    digits = '0' + digits.substring(2);
  }
  return digits;
}

export function formatAusMobile(input: string): string {
  const digits = cleanPhoneNumber(input);
  if (digits.length <= 4) {
    return digits;
  } else if (digits.length <= 7) {
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  } else {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }
}

export function isValidAusMobile(input: string): boolean {
  const digits = cleanPhoneNumber(input);
  return digits.length === 10 && digits.startsWith('04');
}

export function getWhatsAppUrl(phone: string, message: string): string {
  const digits = cleanPhoneNumber(phone);
  // WhatsApp international format without leading + or 0, for Aus: 614XXXXXXXX
  const waNumber = digits.startsWith('04') ? `61${digits.substring(1)}` : digits;
  const encodedMsg = encodeURIComponent(message);
  return `https://wa.me/${waNumber}?text=${encodedMsg}`;
}
