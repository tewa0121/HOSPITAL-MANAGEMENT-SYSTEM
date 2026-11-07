-- Step 14: public appointment requests from the home page
-- Run this in your HMS database (same way you ran the earlier .sql files).

CREATE TABLE IF NOT EXISTS appointment_requests (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  full_name      VARCHAR(120) NOT NULL,
  phone          VARCHAR(20)  NOT NULL,
  department     VARCHAR(100) NOT NULL,
  preferred_date DATE         NOT NULL,
  message        VARCHAR(500) NULL,
  status         ENUM('new','contacted','scheduled','cancelled') NOT NULL DEFAULT 'new',
  created_at     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_requests_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
