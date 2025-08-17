-- Supabase Database Setup for CJ Chat Application
-- Run this script in your Supabase SQL Editor

-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id VARCHAR(10) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,
    room_id VARCHAR(10) REFERENCES rooms(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages(room_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_rooms_last_activity ON rooms(last_activity);

-- Enable Row Level Security (RLS) - optional but recommended
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access (since this is a public chat app)
CREATE POLICY "Allow anonymous read access to rooms" ON rooms
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert access to rooms" ON rooms
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to rooms" ON rooms
    FOR UPDATE USING (true);

CREATE POLICY "Allow anonymous delete access to rooms" ON rooms
    FOR DELETE USING (true);

CREATE POLICY "Allow anonymous read access to messages" ON messages
    FOR SELECT USING (true);

CREATE POLICY "Allow anonymous insert access to messages" ON messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow anonymous delete access to messages" ON messages
    FOR DELETE USING (true);

-- Optional: Create a function to automatically update last_activity when messages are inserted
CREATE OR REPLACE FUNCTION update_room_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE rooms 
    SET last_activity = NOW() 
    WHERE id = NEW.room_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update room activity when messages are added
CREATE TRIGGER update_room_activity_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_room_activity();

-- Optional: Create a function to clean up old rooms and messages
-- This can be called periodically or set up as a cron job
CREATE OR REPLACE FUNCTION cleanup_old_rooms(hours_old INTEGER DEFAULT 24)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete messages from old rooms first (due to foreign key constraint)
    DELETE FROM messages 
    WHERE room_id IN (
        SELECT id FROM rooms 
        WHERE last_activity < NOW() - INTERVAL '1 hour' * hours_old
    );
    
    -- Then delete the old rooms
    DELETE FROM rooms 
    WHERE last_activity < NOW() - INTERVAL '1 hour' * hours_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql; 