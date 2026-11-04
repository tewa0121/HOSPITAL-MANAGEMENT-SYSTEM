USE hms_db;

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