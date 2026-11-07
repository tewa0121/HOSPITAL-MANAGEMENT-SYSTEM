USE hms_db;

-- 1. Appointment requests: reference code for patients + handling info for staff
ALTER TABLE appointment_requests
  ADD COLUMN reference      CHAR(8)      NULL AFTER id,
  ADD COLUMN staff_note     VARCHAR(255) NULL,
  ADD COLUMN handled_by     INT          NULL,
  ADD COLUMN handled_at     DATETIME     NULL,
  ADD COLUMN appointment_id INT          NULL,
  ADD UNIQUE KEY uq_requests_reference (reference);

-- give old test requests a reference too
UPDATE appointment_requests
SET reference = UPPER(SUBSTRING(MD5(CONCAT(id, RAND())), 1, 8))
WHERE reference IS NULL;

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
