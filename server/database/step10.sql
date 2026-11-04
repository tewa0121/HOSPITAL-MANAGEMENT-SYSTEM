USE hms_db;

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