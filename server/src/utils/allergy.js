// Demo-level check by drug name and drug family (not a full interaction database)
const FAMILIES = {
  penicillin: ['penicillin', 'amoxicillin', 'ampicillin'],
  sulfa: ['sulfa', 'sulfamethoxazole', 'cotrimoxazole'],
  nsaid: ['nsaid', 'ibuprofen', 'diclofenac', 'aspirin'],
  cephalosporin: ['cephalosporin', 'ceftriaxone', 'cefalexin', 'cefixime'],
};

function allergyTerms(allergen) {
  const a = allergen.toLowerCase().trim();
  const terms = new Set([a]);
  Object.entries(FAMILIES).forEach(([key, list]) => {
    if (a.includes(key) || list.some((x) => a.includes(x))) list.forEach((x) => terms.add(x));
  });
  return [...terms];
}

// allergies: [{ allergen, severity }], meds: [{ generic_name, brand_name }]
function findConflicts(allergies, meds) {
  const out = [];
  meds.forEach((m) => {
    const names = [m.generic_name, m.brand_name].filter(Boolean).map((s) => s.toLowerCase());
    allergies.forEach((a) => {
      const hit = allergyTerms(a.allergen).some((term) => term.length >= 3 && names.some((n) => n.includes(term)));
      if (hit) out.push({ medication: m.generic_name, allergen: a.allergen, severity: a.severity });
    });
  });
  return out;
}

module.exports = { findConflicts };