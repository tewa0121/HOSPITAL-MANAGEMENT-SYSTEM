const GRACE_MIN = 120; // a bed released by a transfer within 2 hours is not charged

// rows: bed assignments ordered by id, each with released_at and minutes (assigned -> released or now)
function withBedDays(rows) {
  return rows.map((r, i) => {
    const minutes = Number(r.minutes);
    const transferredOut = !!r.released_at && i < rows.length - 1;
    const days = transferredOut && minutes < GRACE_MIN ? 0 : Math.max(1, Math.ceil(minutes / 1440));
    return { ...r, minutes, days };
  });
}

module.exports = { withBedDays, GRACE_MIN };