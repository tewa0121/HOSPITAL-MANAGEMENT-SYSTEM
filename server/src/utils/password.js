const crypto = require('crypto');

// no look-alike characters (0/O, 1/l/I)
const UP = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOW = 'abcdefghijkmnopqrstuvwxyz';
const DIG = '23456789';
const pick = (s) => s[crypto.randomInt(s.length)];

function generateTempPassword(length = 10) {
  const chars = [pick(UP), pick(LOW), pick(DIG)]; // always passes the password rules
  const all = UP + LOW + DIG;
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

module.exports = { generateTempPassword };