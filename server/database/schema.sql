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