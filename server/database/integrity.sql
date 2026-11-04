USE hms_db;

-- 1. a batch can never be negative or have more taken out than was received
SELECT b.batch_no, b.quantity_received, b.quantity_available,
       (SELECT COALESCE(SUM(d.quantity), 0) FROM dispensing d WHERE d.batch_id = b.id) AS dispensed
FROM medication_batches b
WHERE b.quantity_available < 0
   OR b.quantity_available + (SELECT COALESCE(SUM(d.quantity), 0) FROM dispensing d WHERE d.batch_id = b.id) > b.quantity_received;

-- 2. dispensed quantity on a prescription item equals the dispensing records
SELECT pi.id FROM prescription_items pi
WHERE pi.quantity_dispensed <> (SELECT COALESCE(SUM(d.quantity), 0) FROM dispensing d WHERE d.prescription_item_id = pi.id)
   OR pi.quantity_dispensed > pi.quantity;

-- 3. no expired batch was ever dispensed from
SELECT d.id FROM dispensing d JOIN medication_batches b ON b.id = d.batch_id
WHERE b.expiry_date < DATE(d.dispensed_at);

-- 4. invoice totals add up and match the payments
SELECT i.invoice_no FROM invoices i
WHERE i.subtotal <> (SELECT COALESCE(SUM(line_total), 0) FROM invoice_items WHERE invoice_id = i.id)
   OR i.total <> i.subtotal - i.discount
   OR i.amount_paid <> (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE invoice_id = i.id)
   OR i.amount_paid > i.total
   OR (i.status = 'paid' AND i.amount_paid < i.total)
   OR (i.status = 'unpaid' AND i.amount_paid <> 0);

-- 5. a refund is always a negative payment with a reason
SELECT receipt_no FROM payments WHERE (amount < 0 AND (reference IS NULL OR reference NOT LIKE 'Refund:%')) OR amount = 0;

-- 6. a bed is occupied if and only if exactly one admitted patient is in it
SELECT b.bed_number FROM beds b
LEFT JOIN admissions a ON a.bed_id = b.id AND a.status = 'admitted'
GROUP BY b.id
HAVING (b.status = 'occupied' AND COUNT(a.id) <> 1) OR (b.status <> 'occupied' AND COUNT(a.id) > 0);

-- 7. one open bed assignment per admitted patient, on the current bed, and none for discharged ones
SELECT a.id FROM admissions a
LEFT JOIN bed_assignments ba ON ba.admission_id = a.id AND ba.released_at IS NULL
GROUP BY a.id, a.status, a.bed_id
HAVING (a.status = 'admitted' AND (COUNT(ba.id) <> 1 OR MAX(ba.bed_id) <> a.bed_id))
    OR (a.status <> 'admitted' AND COUNT(ba.id) > 0);

-- 8. verified lab results are complete; nothing unverified claims to be verified
SELECT id FROM lab_orders
WHERE (status = 'verified' AND (verified_by IS NULL OR verified_at IS NULL OR result_value IS NULL OR result_flag IS NULL))
   OR (status <> 'verified' AND verified_at IS NOT NULL);

-- 9. a completed visit always has a diagnosis and a closing time
SELECT e.id FROM encounters e
WHERE e.status = 'completed'
  AND (e.closed_at IS NULL OR NOT EXISTS (SELECT 1 FROM diagnoses d WHERE d.encounter_id = e.id));

-- 10. each visit and each admission has at most one active invoice
SELECT encounter_id FROM invoices WHERE encounter_id IS NOT NULL AND status <> 'cancelled' GROUP BY encounter_id HAVING COUNT(*) > 1;
SELECT admission_id FROM invoices WHERE admission_id IS NOT NULL AND status <> 'cancelled' GROUP BY admission_id HAVING COUNT(*) > 1;

-- 11. a doctor never has two scheduled appointments at the same time
SELECT a.id, b.id AS clashes_with FROM appointments a JOIN appointments b
  ON a.doctor_id = b.doctor_id AND a.appointment_date = b.appointment_date AND a.id < b.id
 AND a.type = 'scheduled' AND b.type = 'scheduled'
 AND a.status NOT IN ('cancelled','no_show') AND b.status NOT IN ('cancelled','no_show')
 AND a.start_time < b.end_time AND a.end_time > b.start_time;

-- 12. access control
SELECT r.name AS role_without_dashboard FROM roles r
WHERE NOT EXISTS (SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                  WHERE rp.role_id = r.id AND p.code = 'dashboard.view');
SELECT u.username, p.code AS redundant_override FROM user_permissions up
JOIN users u ON u.id = up.user_id JOIN permissions p ON p.id = up.permission_id
LEFT JOIN role_permissions rp ON rp.role_id = u.role_id AND rp.permission_id = up.permission_id
WHERE (up.is_granted = 1 AND rp.role_id IS NOT NULL) OR (up.is_granted = 0 AND rp.role_id IS NULL);

-- 13. no secrets in the audit log
SELECT id, action FROM audit_logs
WHERE details LIKE '%temporary_password%' OR details LIKE '%$2a$%' OR details LIKE '%password_hash%';

-- 14. this one SHOULD return a number of 1 or more: active super administrators
SELECT COUNT(*) AS active_super_admins FROM users u JOIN roles r ON r.id = u.role_id
WHERE r.name = 'super_admin' AND u.is_active = 1;