USE hms_db;

INSERT INTO permissions (code, module, action, description)
VALUES ('reports.hospital', 'reports', 'hospital', 'View hospital-wide reports (overview, clinical, laboratory, inpatient)');

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p
WHERE p.code = 'reports.hospital' AND r.name IN ('super_admin', 'hospital_admin');