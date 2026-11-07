export const METHODS = ['cash', 'telebirr', 'cbe_birr', 'bank_transfer'];
export const NEEDS_REF = ['telebirr', 'cbe_birr', 'bank_transfer'];
export const INV_TONE = { unpaid: 'red', partial: 'amber', paid: 'green', cancelled: 'slate' };

// money is compared in whole cents to avoid floating point surprises
export const toCents = (v) => Math.round(Number(v || 0) * 100);
export const fromCents = (c) => c / 100;
export const isMoney = (v) => /^\d+(\.\d{1,2})?$/.test(String(v).trim());