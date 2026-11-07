export const REGIONS = [
  'Addis Ababa', 'Afar', 'Amhara', 'Benishangul-Gumuz', 'Central Ethiopia', 'Dire Dawa',
  'Gambela', 'Harari', 'Oromia', 'Sidama', 'Somali', 'South Ethiopia',
  'South West Ethiopia', 'Tigray',
];

export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export const MARITAL = ['single', 'married', 'divorced', 'widowed'];
export const RELATIONSHIPS = ['Spouse', 'Parent', 'Child', 'Sibling', 'Relative', 'Friend', 'Other'];
export const SEVERITIES = ['mild', 'moderate', 'severe'];

// Ethiopian mobile numbers: 09XXXXXXXX (Ethio telecom) or 07XXXXXXXX (Safaricom)
export const PHONE_RE = /^(\+251|251|0)?[79]\d{8}$/;

export const STATUS_TONE = {
  scheduled: 'blue',
  checked_in: 'amber',
  in_consultation: 'teal',
  completed: 'green',
  cancelled: 'red',
  no_show: 'slate',
};
export const ENCOUNTER_TONE = {
  waiting: 'amber',
  triaged: 'blue',
  in_consultation: 'teal',
  awaiting_results: 'amber',
  completed: 'green',
  cancelled: 'red',
};

export const LAB_TONE = {
  ordered: 'slate', collected: 'blue', processing: 'blue', resulted: 'amber',
  verified: 'green', rejected: 'red', cancelled: 'red',
};

export const FLAG_TONE = { normal: 'green', low: 'amber', high: 'red', critical: 'red' };

// value is saved in English for the pharmacist; label comes from translations
export const FREQUENCIES = [
  { code: 'OD', value: 'OD - Once daily', perDay: 1 },
  { code: 'BD', value: 'BD - Twice daily', perDay: 2 },
  { code: 'TDS', value: 'TDS - Three times daily', perDay: 3 },
  { code: 'QID', value: 'QID - Four times daily', perDay: 4 },
  { code: 'HS', value: 'HS - At night', perDay: 1 },
  { code: 'PRN', value: 'PRN - When needed', perDay: 0 },
];

export const COMMON_DIAGNOSES = [
  { code: 'B54', name: 'Malaria, unspecified' },
  { code: 'A01.0', name: 'Typhoid fever' },
  { code: 'A75.9', name: 'Typhus fever, unspecified' },
  { code: 'J06.9', name: 'Acute upper respiratory infection' },
  { code: 'J18.9', name: 'Pneumonia, unspecified' },
  { code: 'J45.9', name: 'Asthma, unspecified' },
  { code: 'I10', name: 'Essential hypertension' },
  { code: 'E11.9', name: 'Type 2 diabetes mellitus' },
  { code: 'K29.7', name: 'Gastritis, unspecified' },
  { code: 'N39.0', name: 'Urinary tract infection' },
  { code: 'A09', name: 'Diarrhoea and gastroenteritis' },
  { code: 'D64.9', name: 'Anaemia, unspecified' },
  { code: 'A16.9', name: 'Tuberculosis, unspecified' },
  { code: 'B82.9', name: 'Intestinal parasitism' },
  { code: 'R50.9', name: 'Fever, unspecified' },
];