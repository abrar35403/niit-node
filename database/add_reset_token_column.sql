-- Add reset_token column to users table
ALTER TABLE users ADD COLUMN reset_token VARCHAR(255) DEFAULT NULL; 