-- Multi-Company migration: run this ONLY if you already have a database from
-- Phase 1-4 (single-company) and want to upgrade it to multi-tenant.
-- If you're setting up fresh, just use the updated models/schema.sql instead.
--
-- Usage: mysql -u root -p bcms_platform < models/migrations/phase5_multi_company.sql
--
-- This creates a "Default Company" and assigns every existing record to it,
-- so your current data keeps working exactly as before under company_id = 1.

CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  industry VARCHAR(100),
  email VARCHAR(150),
  phone VARCHAR(20),
  address VARCHAR(255),
  plan ENUM('trial', 'basic', 'pro', 'enterprise') DEFAULT 'trial',
  status ENUM('active', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO companies (id, name, slug, plan, status) VALUES (1, 'Default Company', 'default', 'enterprise', 'active');

INSERT IGNORE INTO roles (id, name, description) VALUES
  (6, 'platform_admin', 'BCMS staff: manages companies/tenants across the whole platform');

ALTER TABLE users ADD COLUMN IF NOT EXISTS company_id INT NULL AFTER id;
UPDATE users SET company_id = 1 WHERE company_id IS NULL;
ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE departments ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE departments ADD CONSTRAINT fk_departments_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE employees ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE employees ADD CONSTRAINT fk_employees_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE employees DROP INDEX employee_code;
ALTER TABLE employees ADD UNIQUE KEY unique_employee_code_per_company (company_id, employee_code);

ALTER TABLE attendance ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE attendance ADD CONSTRAINT fk_attendance_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE leave_requests ADD CONSTRAINT fk_leaves_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE payroll ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE payroll ADD CONSTRAINT fk_payroll_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE customers ADD CONSTRAINT fk_customers_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE leads ADD CONSTRAINT fk_leads_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE projects ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE projects ADD CONSTRAINT fk_projects_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE documents ADD CONSTRAINT fk_documents_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE notifications ADD CONSTRAINT fk_notifications_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

ALTER TABLE settings ADD COLUMN IF NOT EXISTS company_id INT NOT NULL DEFAULT 1 AFTER id;
ALTER TABLE settings ADD CONSTRAINT fk_settings_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE settings DROP INDEX setting_key;
ALTER TABLE settings ADD UNIQUE KEY unique_setting_per_company (company_id, setting_key);

-- After running this, all your existing data lives under company_id = 1 ("Default Company").
-- Update its name/slug to your actual company name:
--   UPDATE companies SET name = 'Your Company Name', slug = 'your-company' WHERE id = 1;
