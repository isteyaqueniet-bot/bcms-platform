-- BCMS Platform - Multi-Company Schema (Phase 1-4 + Multi-Tenancy)
-- Run this against your MySQL server: mysql -u root -p < schema.sql
--
-- MULTI-TENANCY MODEL:
-- - `companies` is the top-level tenant table. Every business record belongs to exactly one company.
-- - `users.company_id` is NULL only for platform-level admins (BCMS staff managing the whole platform).
-- - Every other table carries `company_id` directly (denormalized) so queries can filter with a
--   single indexed column instead of joining through employees/projects/etc. every time.

-- CREATE DATABASE IF NOT EXISTS bcms_platform;
-- USE bcms_platform;

-- Companies (tenants)
CREATE TABLE IF NOT EXISTS companies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,        -- used in subdomains/URLs, e.g. 'acme-hospital'
  industry VARCHAR(100),                    -- IT services, school, hospital, retail, etc.
  email VARCHAR(150),
  phone VARCHAR(20),
  address VARCHAR(255),
  plan ENUM('trial', 'basic', 'pro', 'enterprise') DEFAULT 'trial',
  status ENUM('active', 'suspended') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Roles (global — every company reuses the same role names)
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description VARCHAR(255)
);

INSERT IGNORE INTO roles (id, name, description) VALUES
  (1, 'super_admin', 'Complete access within their own company'),
  (2, 'admin', 'Manage employees, CRM, reports within their company'),
  (3, 'hr', 'Attendance, leave, payroll within their company'),
  (4, 'sales', 'Leads, customers, follow-ups within their company'),
  (5, 'employee', 'Profile, attendance, leave, tasks within their company'),
  (6, 'platform_admin', 'BCMS staff: manages companies/tenants across the whole platform');

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Users (login accounts)
-- company_id is NULL only for role = 'platform_admin'
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Employees
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  user_id INT UNIQUE,
  employee_code VARCHAR(20) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  department_id INT,
  designation VARCHAR(100),
  phone VARCHAR(20),
  address VARCHAR(255),
  date_of_joining DATE,
  salary DECIMAL(12,2),
  status ENUM('active', 'inactive', 'terminated') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_employee_code_per_company (company_id, employee_code)
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  employee_id INT NOT NULL,
  date DATE NOT NULL,
  check_in TIME,
  check_out TIME,
  check_in_lat DECIMAL(10,7),
  check_in_lng DECIMAL(10,7),
  check_in_method ENUM('manual', 'qr', 'gps') DEFAULT 'manual',
  status ENUM('present', 'absent', 'half_day', 'leave') DEFAULT 'present',
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_attendance (employee_id, date)
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  employee_id INT NOT NULL,
  leave_type VARCHAR(50),
  start_date DATE,
  end_date DATE,
  reason VARCHAR(255),
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Payroll
CREATE TABLE IF NOT EXISTS payroll (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  employee_id INT NOT NULL,
  month INT NOT NULL,
  year INT NOT NULL,
  basic_salary DECIMAL(12,2) NOT NULL,
  working_days INT NOT NULL,
  present_days INT NOT NULL,
  absent_days INT NOT NULL,
  net_salary DECIMAL(12,2) NOT NULL,
  status ENUM('draft', 'finalized', 'paid') DEFAULT 'draft',
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_payroll (employee_id, month, year),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Customers (CRM)
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  company_name VARCHAR(150),
  email VARCHAR(150),
  phone VARCHAR(20),
  address VARCHAR(255),
  assigned_to INT,               -- sales user handling this account
  status ENUM('active', 'inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Leads (CRM)
CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(20),
  source VARCHAR(100),
  status ENUM('new', 'contacted', 'qualified', 'converted', 'lost') DEFAULT 'new',
  assigned_to INT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  customer_id INT,
  start_date DATE,
  end_date DATE,
  status ENUM('planned', 'in_progress', 'completed', 'on_hold') DEFAULT 'planned',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  project_id INT,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  assigned_to INT,
  due_date DATE,
  status ENUM('todo', 'in_progress', 'done') DEFAULT 'todo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Documents
CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  title VARCHAR(150),
  file_path VARCHAR(255) NOT NULL,
  uploaded_by INT,
  related_type VARCHAR(50),
  related_id INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  user_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Settings (per-company key-value config, e.g. office_latitude/office_longitude)
CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value VARCHAR(255),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_setting_per_company (company_id, setting_key)
);

-- Inventory items (consumable/stock — e.g. office supplies, spare parts)
CREATE TABLE IF NOT EXISTS inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(50),
  category VARCHAR(100),
  unit VARCHAR(20) DEFAULT 'pcs',          -- pcs, box, kg, liter, etc.
  quantity INT NOT NULL DEFAULT 0,
  reorder_level INT DEFAULT 0,             -- triggers a "low stock" flag when quantity falls at/below this
  unit_cost DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_sku_per_company (company_id, sku)
);

-- Inventory transactions (audit trail of every stock in/out movement)
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  item_id INT NOT NULL,
  change_qty INT NOT NULL,                 -- positive = stock in, negative = stock out
  reason VARCHAR(255),
  performed_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Assets (non-consumable, trackable items — e.g. laptops, vehicles, furniture)
CREATE TABLE IF NOT EXISTS assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  asset_code VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  purchase_date DATE,
  purchase_cost DECIMAL(12,2),
  status ENUM('available', 'assigned', 'maintenance', 'retired') DEFAULT 'available',
  assigned_to INT,                          -- current holder, if any (employees.id)
  location VARCHAR(150),
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_asset_code_per_company (company_id, asset_code)
);

-- Asset assignment history (audit trail of who held an asset and when)
CREATE TABLE IF NOT EXISTS asset_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  asset_id INT NOT NULL,
  employee_id INT NOT NULL,
  assigned_date DATE NOT NULL,
  returned_date DATE,
  notes VARCHAR(255),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);
