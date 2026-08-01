-- Phase 4 migration: adds GPS/QR tracking columns to an existing `attendance` table.
-- Run this only if your database was created before Phase 4 (i.e. you already ran
-- schema.sql from Phase 1-3). If you're setting up fresh, schema.sql already includes these.
--
-- Usage: mysql -u root -p bcms_platform < models/migrations/phase4_attendance_gps.sql

ALTER TABLE attendance
  ADD COLUMN IF NOT EXISTS check_in_lat DECIMAL(10,7) AFTER check_out,
  ADD COLUMN IF NOT EXISTS check_in_lng DECIMAL(10,7) AFTER check_in_lat,
  ADD COLUMN IF NOT EXISTS check_in_method ENUM('manual', 'qr', 'gps') DEFAULT 'manual' AFTER check_in_lng;
