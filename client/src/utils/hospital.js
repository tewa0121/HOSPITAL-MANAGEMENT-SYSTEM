// Public website details. Edit here and every public page updates.
export const NAME = { en: 'INJIBARA GENERAL HOSPITAL', am: 'እንጂባራ ጠቅላላ ሆስፒታል' };

export const CONTACT = {
  address: 'Injibara, Ethiopia',
  phone: '+251 920 954 224',
  email: 'tewachewmelaku6@gmail.com',
  hours: { en: 'Mon – Sun: 24 Hours', am: 'ሰኞ – እሑድ፡ 24 ሰዓት' },
};

export const langOf = (i18n) => (i18n.language?.startsWith('am') ? 'am' : 'en');
