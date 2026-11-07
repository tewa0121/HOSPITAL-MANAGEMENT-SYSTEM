-- =====================================================================
-- HMS (Hospital Management System) - COMPLETE DATABASE IN ONE FILE
-- Includes: schema + seed + step10 + step11 + step12 + steps 14/15
--           (appointment requests, news, new permissions)
--
-- HOW TO USE (also after a MAMP crash / lost database):
--   1. Start MAMP, open phpMyAdmin, click the SQL tab (no database selected)
--      or run in the mysql client:  SOURCE server/database/hms_full_database.sql;
--   2. Paste/import this WHOLE file once. It creates database hms_db.
--   3. In the server folder run:  node database/seedUsers.js
--      (creates the 9 login accounts, password Hms@2026)
--   4. Optional demo patients/visits:  node database/seedDemo.js
--
-- WARNING: run it on an EMPTY database. To start from zero, first run:
--          DROP DATABASE IF EXISTS hms_db;
--   (This deletes ALL data. Do not run it if you want to keep your data.)
-- =====================================================================


-- =====================================================================
-- PART 1: schema (tables)
-- =====================================================================
-- =====================================================
-- HMS Database Schema (MySQL 5.7+ / MAMP)
-- =====================================================
CREATE DATABASE IF NOT EXISTS hms_db
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hms_db;

-- ---------- ACCESS CONTROL ----------
CREATE TABLE departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  name_am VARCHAR(100) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  display_name_am VARCHAR(100) NULL,
  description VARCHAR(255) NULL,
  is_system TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(80) NOT NULL UNIQUE,      -- e.g. patients.create
  module VARCHAR(40) NOT NULL,
  action VARCHAR(40) NOT NULL,
  description VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE role_permissions (
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(120) NULL UNIQUE,
  phone VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  department_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (department_id) REFERENCES departments(id)
) ENGINE=InnoDB;

-- Per-user overrides: grant or revoke a single permission for one user
CREATE TABLE user_permissions (
  user_id INT NOT NULL,
  permission_id INT NOT NULL,
  is_granted TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (user_id, permission_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE login_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  username VARCHAR(50) NOT NULL,
  success TINYINT(1) NOT NULL,
  ip_address VARCHAR(45) NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_user (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  action VARCHAR(60) NOT NULL,           -- CREATE, UPDATE, DELETE, VIEW, LOGIN...
  module VARCHAR(40) NOT NULL,
  record_id VARCHAR(40) NULL,
  details JSON NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_module (module),
  INDEX idx_audit_date (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE settings (
  setting_key VARCHAR(60) PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB;

-- ---------- PATIENTS ----------
CREATE TABLE patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  mrn VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(60) NOT NULL,
  father_name VARCHAR(60) NOT NULL,
  grandfather_name VARCHAR(60) NULL,
  gender ENUM('male','female') NOT NULL,
  date_of_birth DATE NOT NULL,
  phone VARCHAR(20) NULL,
  region VARCHAR(60) NULL,
  zone VARCHAR(60) NULL,
  woreda VARCHAR(60) NULL,
  kebele VARCHAR(40) NULL,
  house_number VARCHAR(30) NULL,
  national_id VARCHAR(30) NULL,          -- Fayda / Kebele ID
  blood_group ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-','unknown') NOT NULL DEFAULT 'unknown',
  marital_status ENUM('single','married','divorced','widowed') NULL,
  occupation VARCHAR(80) NULL,
  status ENUM('active','inactive','deceased') NOT NULL DEFAULT 'active',
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_patient_name (first_name, father_name),
  INDEX idx_patient_phone (phone),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE patient_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  relationship VARCHAR(40) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE allergies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  allergen VARCHAR(100) NOT NULL,
  reaction VARCHAR(150) NULL,
  severity ENUM('mild','moderate','severe') NOT NULL DEFAULT 'mild',
  recorded_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- APPOINTMENTS & OPD ----------
CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  department_id INT NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  type ENUM('scheduled','walk_in') NOT NULL DEFAULT 'scheduled',
  status ENUM('scheduled','checked_in','in_consultation','completed','cancelled','no_show') NOT NULL DEFAULT 'scheduled',
  queue_number INT NULL,
  reason VARCHAR(255) NULL,
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_appt_doctor_slot (doctor_id, appointment_date, start_time),
  INDEX idx_appt_patient (patient_id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES users(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE encounters (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  appointment_id INT NULL,
  doctor_id INT NULL,
  encounter_type ENUM('opd','emergency','inpatient') NOT NULL DEFAULT 'opd',
  status ENUM('waiting','triaged','in_consultation','awaiting_results','completed','cancelled') NOT NULL DEFAULT 'waiting',
  chief_complaint TEXT NULL,
  history_present_illness TEXT NULL,
  examination TEXT NULL,
  treatment_plan TEXT NULL,
  follow_up_date DATE NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  INDEX idx_enc_patient (patient_id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE vital_signs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  encounter_id INT NOT NULL,
  patient_id INT NOT NULL,
  temperature_c DECIMAL(4,1) NULL,
  pulse INT NULL,
  respiratory_rate INT NULL,
  bp_systolic INT NULL,
  bp_diastolic INT NULL,
  spo2 INT NULL,
  weight_kg DECIMAL(5,1) NULL,
  height_cm DECIMAL(5,1) NULL,
  recorded_by INT NULL,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE diagnoses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  encounter_id INT NOT NULL,
  patient_id INT NOT NULL,
  icd10_code VARCHAR(10) NULL,
  description VARCHAR(255) NOT NULL,
  type ENUM('primary','secondary') NOT NULL DEFAULT 'primary',
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- SERVICE CATALOG (prices in ETB) ----------
CREATE TABLE service_catalog (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  name_am VARCHAR(120) NULL,
  category ENUM('consultation','laboratory','pharmacy','bed','procedure','other') NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

-- ---------- LABORATORY ----------
CREATE TABLE lab_tests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  category VARCHAR(60) NULL,
  specimen VARCHAR(60) NULL,
  unit VARCHAR(30) NULL,
  ref_low DECIMAL(10,2) NULL,
  ref_high DECIMAL(10,2) NULL,
  ref_text VARCHAR(100) NULL,
  service_id INT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE lab_orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  encounter_id INT NOT NULL,
  patient_id INT NOT NULL,
  test_id INT NOT NULL,
  ordered_by INT NOT NULL,
  priority ENUM('routine','urgent') NOT NULL DEFAULT 'routine',
  status ENUM('ordered','collected','processing','resulted','verified','rejected','cancelled') NOT NULL DEFAULT 'ordered',
  barcode VARCHAR(30) NULL UNIQUE,
  collected_by INT NULL,
  collected_at DATETIME NULL,
  result_value VARCHAR(100) NULL,
  result_flag ENUM('normal','low','high','critical') NULL,
  result_comment VARCHAR(255) NULL,
  resulted_by INT NULL,
  resulted_at DATETIME NULL,
  verified_by INT NULL,
  verified_at DATETIME NULL,
  reject_reason VARCHAR(200) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_lab_status (status),
  FOREIGN KEY (encounter_id) REFERENCES encounters(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (test_id) REFERENCES lab_tests(id),
  FOREIGN KEY (ordered_by) REFERENCES users(id),
  FOREIGN KEY (collected_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (resulted_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- PHARMACY ----------
CREATE TABLE medications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  generic_name VARCHAR(120) NOT NULL,
  brand_name VARCHAR(120) NULL,
  form VARCHAR(40) NOT NULL,             -- tablet, capsule, syrup, injection
  strength VARCHAR(40) NULL,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 50,
  is_controlled TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  INDEX idx_med_name (generic_name)
) ENGINE=InnoDB;

CREATE TABLE medication_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  medication_id INT NOT NULL,
  batch_no VARCHAR(40) NOT NULL,
  expiry_date DATE NOT NULL,
  quantity_received INT NOT NULL,
  quantity_available INT NOT NULL,
  received_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_med_batch (medication_id, batch_no),
  INDEX idx_batch_expiry (expiry_date),
  FOREIGN KEY (medication_id) REFERENCES medications(id),
  CONSTRAINT chk_qty CHECK (quantity_available >= 0)
) ENGINE=InnoDB;

CREATE TABLE prescriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  encounter_id INT NOT NULL,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  status ENUM('pending','partially_dispensed','dispensed','cancelled') NOT NULL DEFAULT 'pending',
  notes VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (encounter_id) REFERENCES encounters(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (doctor_id) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE prescription_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prescription_id INT NOT NULL,
  medication_id INT NOT NULL,
  dosage VARCHAR(60) NOT NULL,
  frequency VARCHAR(60) NOT NULL,
  duration_days INT NOT NULL,
  quantity INT NOT NULL,
  quantity_dispensed INT NOT NULL DEFAULT 0,
  instructions VARCHAR(200) NULL,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (medication_id) REFERENCES medications(id)
) ENGINE=InnoDB;

CREATE TABLE dispensing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prescription_item_id INT NOT NULL,
  batch_id INT NOT NULL,
  quantity INT NOT NULL,
  dispensed_by INT NOT NULL,
  dispensed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prescription_item_id) REFERENCES prescription_items(id),
  FOREIGN KEY (batch_id) REFERENCES medication_batches(id),
  FOREIGN KEY (dispensed_by) REFERENCES users(id)
) ENGINE=InnoDB;

-- ---------- WARDS, BEDS, ADMISSIONS ----------
CREATE TABLE wards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(80) NOT NULL,
  name_am VARCHAR(80) NULL,
  capacity INT NOT NULL DEFAULT 0,
  daily_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE beds (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ward_id INT NOT NULL,
  bed_number VARCHAR(20) NOT NULL,
  status ENUM('available','occupied','reserved','cleaning','maintenance') NOT NULL DEFAULT 'available',
  UNIQUE KEY uq_ward_bed (ward_id, bed_number),
  FOREIGN KEY (ward_id) REFERENCES wards(id)
) ENGINE=InnoDB;

CREATE TABLE admissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  encounter_id INT NULL,
  bed_id INT NOT NULL,
  admitting_doctor_id INT NOT NULL,
  reason VARCHAR(255) NULL,
  status ENUM('admitted','discharged','transferred') NOT NULL DEFAULT 'admitted',
  admitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  discharged_at DATETIME NULL,
  discharged_by INT NULL,
  discharge_summary TEXT NULL,
  INDEX idx_adm_status (status),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL,
  FOREIGN KEY (bed_id) REFERENCES beds(id),
  FOREIGN KEY (admitting_doctor_id) REFERENCES users(id),
  FOREIGN KEY (discharged_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ---------- BILLING (ETB) ----------
CREATE TABLE invoices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_no VARCHAR(25) NOT NULL UNIQUE,
  patient_id INT NOT NULL,
  encounter_id INT NULL,
  admission_id INT NULL,
  subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount DECIMAL(12,2) NOT NULL DEFAULT 0,
  discount_approved_by INT NULL,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('unpaid','partial','paid','cancelled') NOT NULL DEFAULT 'unpaid',
  created_by INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_inv_patient (patient_id),
  INDEX idx_inv_status (status),
  FOREIGN KEY (patient_id) REFERENCES patients(id),
  FOREIGN KEY (encounter_id) REFERENCES encounters(id) ON DELETE SET NULL,
  FOREIGN KEY (admission_id) REFERENCES admissions(id) ON DELETE SET NULL,
  FOREIGN KEY (discount_approved_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE invoice_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  invoice_id INT NOT NULL,
  service_id INT NULL,
  description VARCHAR(200) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  reference_type ENUM('consultation','lab_order','prescription','admission','other') NULL,
  reference_id INT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES service_catalog(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  receipt_no VARCHAR(25) NOT NULL UNIQUE,
  invoice_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  method ENUM('cash','telebirr','cbe_birr','bank_transfer','insurance','other') NOT NULL DEFAULT 'cash',
  reference VARCHAR(80) NULL,            -- transaction ID for mobile money / bank
  received_by INT NOT NULL,
  paid_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (received_by) REFERENCES users(id)
) ENGINE=InnoDB;


-- =====================================================================
-- PART 2: seed (departments, roles, permissions, role grants, catalogs, settings)
-- =====================================================================
-- ---------- DEPARTMENTS ----------
INSERT INTO departments (name, name_am) VALUES
('Administration','አስተዳደር'),
('Reception','መቀበያ'),
('General OPD','ተመላላሽ ህክምና'),
('Emergency','ድንገተኛ ህክምና'),
('Internal Medicine','ውስጥ ደዌ'),
('Pediatrics','ሕፃናት ህክምና'),
('Gynecology & Obstetrics','የማህጸንና ጽንስ ህክምና'),
('Surgery','ቀዶ ጥገና'),
('Laboratory','ላቦራቶሪ'),
('Pharmacy','ፋርማሲ'),
('Finance','ፋይናንስ');

-- ---------- ROLES ----------
INSERT INTO roles (name, display_name, display_name_am, description, is_system) VALUES
('super_admin','Super Administrator','ዋና አስተዳዳሪ','Full system control',1),
('hospital_admin','Hospital Administrator','የሆስፒታል አስተዳዳሪ','Operations, users and reports (no clinical records)',1),
('doctor','Doctor','ሐኪም','Consultations, diagnoses, orders, prescriptions',1),
('nurse','Nurse','ነርስ','Vital signs, triage, ward care',1),
('receptionist','Receptionist','ተቀባይ','Patient registration and appointments',1),
('lab_technician','Laboratory Technician','ላብራቶሪ ባለሙያ','Samples and test results',1),
('pharmacist','Pharmacist','ፋርማሲስት','Dispensing and drug stock',1),
('cashier','Cashier','ገንዘብ ተቀባይ','Invoices and payments',1);

-- ---------- PERMISSIONS ----------
INSERT INTO permissions (code, module, action, description) VALUES
('dashboard.view','dashboard','view','View own dashboard'),
('patients.create','patients','create','Register patients'),
('patients.read','patients','read','View patient profiles'),
('patients.update','patients','update','Edit patient information'),
('patients.delete','patients','delete','Deactivate patients'),
('appointments.create','appointments','create','Book appointments'),
('appointments.read','appointments','read','View appointments'),
('appointments.update','appointments','update','Reschedule appointments'),
('appointments.cancel','appointments','cancel','Cancel appointments'),
('appointments.checkin','appointments','checkin','Check patients in / manage queue'),
('encounters.create','encounters','create','Start a consultation'),
('encounters.read','encounters','read','View clinical encounters'),
('encounters.update','encounters','update','Write clinical notes'),
('encounters.close','encounters','close','Close an encounter'),
('vitals.create','vitals','create','Record vital signs'),
('vitals.read','vitals','read','View vital signs'),
('diagnoses.create','diagnoses','create','Enter diagnoses'),
('diagnoses.read','diagnoses','read','View diagnoses'),
('lab.order','lab','order','Order lab tests'),
('lab.read','lab','read','View lab orders and results'),
('lab.collect','lab','collect','Collect samples'),
('lab.enter_result','lab','enter_result','Enter test results'),
('lab.verify','lab','verify','Verify and release results'),
('lab.manage_catalog','lab','manage_catalog','Manage lab test catalog'),
('prescriptions.create','prescriptions','create','Write prescriptions'),
('prescriptions.read','prescriptions','read','View prescriptions'),
('prescriptions.dispense','prescriptions','dispense','Dispense medication'),
('pharmacy.stock_read','pharmacy','stock_read','View drug stock'),
('pharmacy.stock_manage','pharmacy','stock_manage','Receive and adjust stock'),
('billing.invoice_create','billing','invoice_create','Create invoices'),
('billing.invoice_read','billing','invoice_read','View invoices'),
('billing.payment_create','billing','payment_create','Receive payments'),
('billing.discount_apply','billing','discount_apply','Approve discounts'),
('billing.refund','billing','refund','Approve refunds'),
('wards.read','wards','read','View wards and beds'),
('wards.manage','wards','manage','Manage wards and beds'),
('admissions.create','admissions','create','Admit patients'),
('admissions.read','admissions','read','View admissions'),
('admissions.discharge','admissions','discharge','Discharge patients'),
('reports.read','reports','read','View reports'),
('reports.export','reports','export','Export reports'),
('users.create','users','create','Create users'),
('users.read','users','read','View users'),
('users.update','users','update','Edit / deactivate users'),
('users.delete','users','delete','Delete users'),
('roles.read','roles','read','View roles'),
('roles.manage','roles','manage','Edit role permissions'),
('audit.read','audit','read','View audit logs'),
('settings.manage','settings','manage','Change system settings');

-- ---------- ROLE -> PERMISSION MAPPING ----------
-- Super admin: everything
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p WHERE r.name = 'super_admin';

-- Hospital admin: operations, finance oversight, NO clinical notes/lab results (privacy)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.name = 'hospital_admin' AND p.code IN (
 'dashboard.view','patients.read','appointments.read','billing.invoice_read',
 'billing.discount_apply','billing.refund','wards.read','wards.manage','admissions.read',
 'reports.read','reports.export','users.create','users.read','users.update',
 'roles.read','audit.read','settings.manage','pharmacy.stock_read');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.name = 'doctor' AND p.code IN (
 'dashboard.view','patients.read','appointments.read','encounters.create','encounters.read',
 'encounters.update','encounters.close','vitals.read','diagnoses.create','diagnoses.read',
 'lab.order','lab.read','prescriptions.create','prescriptions.read',
 'admissions.create','admissions.read','admissions.discharge','wards.read');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.name = 'nurse' AND p.code IN (
 'dashboard.view','patients.read','appointments.read','appointments.checkin',
 'encounters.read','vitals.create','vitals.read','lab.read','lab.collect',
 'prescriptions.read','wards.read','admissions.read');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.name = 'receptionist' AND p.code IN (
 'dashboard.view','patients.create','patients.read','patients.update',
 'appointments.create','appointments.read','appointments.update',
 'appointments.cancel','appointments.checkin');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.name = 'lab_technician' AND p.code IN (
 'dashboard.view','patients.read','lab.read','lab.collect','lab.enter_result',
 'lab.verify','lab.manage_catalog');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.name = 'pharmacist' AND p.code IN (
 'dashboard.view','patients.read','prescriptions.read','prescriptions.dispense',
 'pharmacy.stock_read','pharmacy.stock_manage','reports.read');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE r.name = 'cashier' AND p.code IN (
 'dashboard.view','patients.read','billing.invoice_create','billing.invoice_read',
 'billing.payment_create','reports.read');

-- ---------- SERVICE CATALOG (sample ETB prices, edit freely) ----------
INSERT INTO service_catalog (code, name, name_am, category, price) VALUES
('CONS-GEN','General Consultation','አጠቃላይ ምርመራ','consultation',150.00),
('CONS-SPE','Specialist Consultation','ስፔሻሊስት ምርመራ','consultation',400.00),
('CONS-EMG','Emergency Consultation','ድንገተኛ ምርመራ','consultation',250.00),
('LAB-CBC','Complete Blood Count','ሙሉ የደም ምርመራ','laboratory',250.00),
('LAB-GLU','Blood Glucose','የደም ስኳር','laboratory',100.00),
('LAB-MAL','Malaria Blood Film','የወባ ምርመራ','laboratory',80.00),
('LAB-URI','Urinalysis','የሽንት ምርመራ','laboratory',100.00),
('LAB-STO','Stool Examination','የሰገራ ምርመራ','laboratory',80.00),
('LAB-HIV','HIV Rapid Test','ኤችአይቪ ምርመራ','laboratory',150.00),
('LAB-HBS','Hepatitis B (HBsAg)','ሄፓታይተስ ቢ','laboratory',200.00),
('LAB-CRE','Serum Creatinine','ክሬያቲኒን','laboratory',150.00),
('BED-GEN','General Ward Bed (per day)','አልጋ (በቀን)','bed',300.00),
('BED-ICU','ICU Bed (per day)','አይሲዩ አልጋ (በቀን)','bed',2500.00),
('PROC-DRS','Wound Dressing','ቁስል ማሰር','procedure',120.00),
('PROC-INJ','Injection Administration','መርፌ','procedure',50.00);

-- ---------- LAB TEST CATALOG ----------
INSERT INTO lab_tests (code, name, category, specimen, unit, ref_low, ref_high, ref_text, service_id) VALUES
('CBC','Complete Blood Count (WBC)','Hematology','Blood','x10^9/L',4.00,11.00,'4.0 - 11.0',(SELECT id FROM service_catalog WHERE code='LAB-CBC')),
('GLU','Blood Glucose (fasting)','Chemistry','Blood','mg/dL',70.00,100.00,'70 - 100',(SELECT id FROM service_catalog WHERE code='LAB-GLU')),
('MAL','Malaria Blood Film','Parasitology','Blood',NULL,NULL,NULL,'Negative',(SELECT id FROM service_catalog WHERE code='LAB-MAL')),
('URI','Urinalysis','Urine','Urine',NULL,NULL,NULL,'Normal',(SELECT id FROM service_catalog WHERE code='LAB-URI')),
('STO','Stool Examination','Parasitology','Stool',NULL,NULL,NULL,'No parasites seen',(SELECT id FROM service_catalog WHERE code='LAB-STO')),
('HIV','HIV Rapid Test','Serology','Blood',NULL,NULL,NULL,'Non-reactive',(SELECT id FROM service_catalog WHERE code='LAB-HIV')),
('HBS','Hepatitis B (HBsAg)','Serology','Blood',NULL,NULL,NULL,'Negative',(SELECT id FROM service_catalog WHERE code='LAB-HBS')),
('CRE','Serum Creatinine','Chemistry','Blood','mg/dL',0.60,1.30,'0.6 - 1.3',(SELECT id FROM service_catalog WHERE code='LAB-CRE'));

-- ---------- MEDICATIONS ----------
INSERT INTO medications (generic_name, brand_name, form, strength, unit_price, reorder_level, is_controlled) VALUES
('Paracetamol',NULL,'Tablet','500 mg',2.00,200,0),
('Amoxicillin',NULL,'Capsule','500 mg',8.00,150,0),
('Ibuprofen',NULL,'Tablet','400 mg',3.00,150,0),
('Metronidazole',NULL,'Tablet','250 mg',3.50,100,0),
('Artemether/Lumefantrine','Coartem','Tablet','20/120 mg',25.00,100,0),
('Amlodipine',NULL,'Tablet','5 mg',4.00,100,0),
('Metformin',NULL,'Tablet','500 mg',3.00,100,0),
('Oral Rehydration Salts','ORS','Sachet','20.5 g',15.00,100,0),
('Ceftriaxone',NULL,'Injection','1 g',60.00,50,0),
('Diazepam',NULL,'Tablet','5 mg',6.00,30,1);

-- ---------- MEDICATION BATCHES (one near expiry, one expired for demo alerts) ----------
INSERT INTO medication_batches (medication_id, batch_no, expiry_date, quantity_received, quantity_available)
SELECT id, 'PCM-2601', '2027-08-31', 1000, 1000 FROM medications WHERE generic_name='Paracetamol'
UNION ALL SELECT id, 'AMX-2602', '2027-06-30', 600, 600 FROM medications WHERE generic_name='Amoxicillin'
UNION ALL SELECT id, 'IBU-2603', '2027-03-31', 500, 500 FROM medications WHERE generic_name='Ibuprofen'
UNION ALL SELECT id, 'MTZ-2604', '2026-12-15', 300, 300 FROM medications WHERE generic_name='Metronidazole'
UNION ALL SELECT id, 'COA-2605', '2027-10-31', 400, 400 FROM medications WHERE generic_name='Artemether/Lumefantrine'
UNION ALL SELECT id, 'AML-2606', '2027-09-30', 300, 300 FROM medications WHERE generic_name='Amlodipine'
UNION ALL SELECT id, 'MET-2607', '2027-05-31', 300, 300 FROM medications WHERE generic_name='Metformin'
UNION ALL SELECT id, 'ORS-2608', '2028-01-31', 250, 250 FROM medications WHERE generic_name='Oral Rehydration Salts'
UNION ALL SELECT id, 'CEF-2609', '2027-04-30', 120, 120 FROM medications WHERE generic_name='Ceftriaxone'
UNION ALL SELECT id, 'DZP-2610', '2026-09-30', 60, 60 FROM medications WHERE generic_name='Diazepam';

-- ---------- WARDS & BEDS ----------
INSERT INTO wards (code, name, name_am, capacity, daily_rate) VALUES
('GM','General Ward - Male','አጠቃላይ ዋርድ - ወንድ',8,300.00),
('GF','General Ward - Female','አጠቃላይ ዋርድ - ሴት',8,300.00),
('PED','Pediatric Ward','የሕፃናት ዋርድ',6,300.00),
('MAT','Maternity Ward','የወሊድ ዋርድ',6,350.00),
('ICU','Intensive Care Unit','ጽኑ ህሙማን ክፍል',4,2500.00);

INSERT INTO beds (ward_id, bed_number)
SELECT w.id, CONCAT(w.code, '-', LPAD(n.n, 2, '0'))
FROM wards w
JOIN (SELECT 1 n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4
      UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8) n
  ON n.n <= w.capacity;

-- ---------- SETTINGS ----------
INSERT INTO settings (setting_key, setting_value) VALUES
('hospital_name','Injibara General Hospital'),
('hospital_name_am','እንጅባራ ጠቅላላ ሆስፒታል'),
('currency','ETB'),
('default_language','en'),
('mrn_prefix','HMS'),
('appointment_slot_minutes','20');


-- =====================================================================
-- PART 3: step 10 (bed assignments, admission notes, bed_status permission)
-- =====================================================================
-- Every bed a patient has occupied during one admission (needed for transfers and bed-day billing)
CREATE TABLE bed_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admission_id INT NOT NULL,
  bed_id INT NOT NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at DATETIME NULL,
  assigned_by INT NULL,
  transfer_reason VARCHAR(200) NULL,
  INDEX idx_ba_adm (admission_id),
  INDEX idx_ba_bed (bed_id),
  FOREIGN KEY (admission_id) REFERENCES admissions(id),
  FOREIGN KEY (bed_id) REFERENCES beds(id),
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Daily progress notes (doctors) and nursing notes (nurses)
CREATE TABLE admission_notes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admission_id INT NOT NULL,
  author_id INT NOT NULL,
  note_type ENUM('progress','nursing') NOT NULL DEFAULT 'progress',
  note TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_an_adm (admission_id),
  FOREIGN KEY (admission_id) REFERENCES admissions(id),
  FOREIGN KEY (author_id) REFERENCES users(id)
) ENGINE=InnoDB;

INSERT INTO permissions (code, module, action, description)
VALUES ('wards.bed_status', 'wards', 'bed_status', 'Change bed status (cleaning, maintenance)');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE p.code = 'wards.bed_status' AND r.name IN ('super_admin', 'hospital_admin', 'nurse');


-- =====================================================================
-- PART 4: step 11 (hospital reports permission)
-- =====================================================================
INSERT INTO permissions (code, module, action, description)
VALUES ('reports.hospital', 'reports', 'hospital', 'View hospital-wide reports (overview, clinical, laboratory, inpatient)');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE p.code = 'reports.hospital' AND r.name IN ('super_admin', 'hospital_admin');


-- =====================================================================
-- PART 5: step 12 (forced password change columns)
-- =====================================================================
ALTER TABLE users
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash,
  ADD COLUMN password_changed_at DATETIME NULL AFTER must_change_password;


-- =====================================================================
-- PART 6: steps 14/15 (appointment requests, news, new permissions)
-- =====================================================================
USE hms_db;

-- Public website: online appointment requests (final shape, includes patient reference code)
CREATE TABLE appointment_requests (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  reference      CHAR(8)      NULL,
  full_name      VARCHAR(120) NOT NULL,
  phone          VARCHAR(20)  NOT NULL,
  department     VARCHAR(100) NOT NULL,
  preferred_date DATE         NOT NULL,
  message        VARCHAR(500) NULL,
  status         ENUM('new','contacted','scheduled','cancelled') NOT NULL DEFAULT 'new',
  staff_note     VARCHAR(255) NULL,
  handled_by     INT          NULL,
  handled_at     DATETIME     NULL,
  appointment_id INT          NULL,
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_requests_reference (reference),
  INDEX idx_requests_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. News, events and announcements shown on the public website
CREATE TABLE news_posts (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  kind         ENUM('news','event','announcement') NOT NULL DEFAULT 'news',
  title_en     VARCHAR(200) NOT NULL,
  title_am     VARCHAR(200) NULL,
  body_en      TEXT NOT NULL,
  body_am      TEXT NULL,
  event_date   DATE NULL,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by   INT NULL,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_news_pub (is_published, published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO news_posts (kind, title_en, title_am, body_en, body_am, event_date) VALUES
('event', 'Free Health Screening Campaign', 'ነፃ የጤና ምርመራ ዘመቻ',
 'Join us for free blood pressure, blood sugar and general health screening at the hospital. Bring your ID card. No appointment is needed.',
 'የደም ግፊት፣ የደም ስኳርና አጠቃላይ የጤና ምርመራ በነፃ ለማድረግ በሆስፒታላችን ይሳተፉ። መታወቂያዎን ይዘው ይምጡ። ቀጠሮ አያስፈልግም።', '2026-11-20'),
('news', 'New Medical Equipment Inaugurated', 'አዲስ የሕክምና መሣሪያ ተመረቀ',
 'Our laboratory and radiology units now use new diagnostic equipment, giving faster and more accurate results for patients.',
 'የላቦራቶሪና የራዲዮሎጂ ክፍሎቻችን አዳዲስ የምርመራ መሣሪያዎችን መጠቀም ጀምረዋል፤ ይህም ለታካሚዎች ፈጣንና ትክክለኛ ውጤት ይሰጣል።', NULL),
('announcement', '24-Hour Emergency Service', 'የ24 ሰዓት የድንገተኛ አገልግሎት',
 'The emergency department is open every day of the week, 24 hours a day. For emergencies, come straight to the emergency entrance.',
 'የድንገተኛ ክፍላችን በሳምንት ሁሉም ቀን በ24 ሰዓት ክፍት ነው። ለድንገተኛ ሁኔታ በቀጥታ ወደ ድንገተኛ መግቢያ ይምጡ።', NULL);

-- 3. Permissions
INSERT INTO permissions (code, module, action, description) VALUES
('appointments.requests', 'appointments', 'requests', 'Handle online appointment requests'),
('news.manage', 'news', 'manage', 'Publish news and announcements');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE p.code = 'appointments.requests' AND r.name IN ('super_admin', 'receptionist');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE p.code = 'news.manage' AND r.name IN ('super_admin', 'hospital_admin');


-- =====================================================================
-- PART 7: quick check (should show 34 tables)
-- =====================================================================
SELECT COUNT(*) AS tables_created FROM information_schema.tables WHERE table_schema = 'hms_db';
SELECT COUNT(*) AS permissions FROM permissions;
SELECT name FROM roles ORDER BY id;


-- =====================================================================
-- OPTIONAL MAINTENANCE SCRIPTS (kept commented out on purpose)
-- Copy the part you need out of the comment block and run it alone.
-- =====================================================================

-- ---- A. reset demo data (clears patients and transactions; keeps users, roles, settings, catalogs) ----
/*
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
*/

-- ---- B. data integrity checks (every query should return NO rows) ----
/*
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
*/