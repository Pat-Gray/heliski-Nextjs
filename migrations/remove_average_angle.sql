-- Remove average_angle column from runs table
-- This migration removes the average_angle field that is no longer needed

ALTER TABLE runs DROP COLUMN IF EXISTS average_angle;
