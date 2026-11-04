USE hms_db;
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE payments;
TRUNCATE TABLE invoice_items;
TRUNCATE TABLE invoices;
TRUNCATE TABLE dispensing;
TRUNCATE TABLE prescription_items;
TRUNCATE TABLE prescriptions;
TRUNCATE TABLE lab_orders;
TRUNCATE TABLE diagnoses;
TRUNCATE TABLE vital_signs;
TRUNCATE TABLE admission_notes;
TRUNCATE TABLE bed_assignments;
TRUNCATE TABLE admissions;
TRUNCATE TABLE encounters;
TRUNCATE TABLE appointments;
TRUNCATE TABLE allergies;
TRUNCATE TABLE patient_contacts;
TRUNCATE TABLE patients;

SET FOREIGN_KEY_CHECKS = 1;

UPDATE medication_batches SET quantity_available = quantity_received;
UPDATE beds SET status = 'available';