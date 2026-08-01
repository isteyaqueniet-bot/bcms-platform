-- Inventory & Asset Management migration: run this if you already have a
-- database from Phase 1-5 and want to add these modules.
-- If you're setting up fresh, models/schema.sql already includes them.
--
-- Usage: mysql -u root -p bcms_platform < models/migrations/phase6_inventory_assets.sql

CREATE TABLE IF NOT EXISTS inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(50),
  category VARCHAR(100),
  unit VARCHAR(20) DEFAULT 'pcs',
  quantity INT NOT NULL DEFAULT 0,
  reorder_level INT DEFAULT 0,
  unit_cost DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_sku_per_company (company_id, sku)
);

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  item_id INT NOT NULL,
  change_qty INT NOT NULL,
  reason VARCHAR(255),
  performed_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
  FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  asset_code VARCHAR(50) NOT NULL,
  category VARCHAR(100),
  purchase_date DATE,
  purchase_cost DECIMAL(12,2),
  status ENUM('available', 'assigned', 'maintenance', 'retired') DEFAULT 'available',
  assigned_to INT,
  location VARCHAR(150),
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  UNIQUE KEY unique_asset_code_per_company (company_id, asset_code)
);

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
