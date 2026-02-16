-- ═══════════════════════════════════════════════════════════════
-- Supabase Database Setup for OMR Scanner
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension (usually enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Templates Table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS templates (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    config_json JSONB NOT NULL DEFAULT '{}',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all templates
CREATE POLICY "templates_select_all" ON templates
    FOR SELECT USING (true);

-- Allow users to insert their own templates
CREATE POLICY "templates_insert_own" ON templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own templates
CREATE POLICY "templates_delete_own" ON templates
    FOR DELETE USING (auth.uid() = user_id);


-- ─── Answer Keys Table ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS answer_keys (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    answers_json JSONB NOT NULL DEFAULT '{}',
    marking_scheme_json JSONB DEFAULT '{"correct": 1, "incorrect": 0, "unmarked": 0}',
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE answer_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "answer_keys_select_all" ON answer_keys
    FOR SELECT USING (true);

CREATE POLICY "answer_keys_insert_own" ON answer_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "answer_keys_update_own" ON answer_keys
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "answer_keys_delete_own" ON answer_keys
    FOR DELETE USING (auth.uid() = user_id);


-- ─── Scan Results Table ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS scan_results (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
    answer_key_id UUID REFERENCES answer_keys(id) ON DELETE SET NULL,
    image_url TEXT,
    detected_answers_json JSONB NOT NULL DEFAULT '{}',
    score NUMERIC,
    total INTEGER,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scan_results_select_own" ON scan_results
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "scan_results_insert_own" ON scan_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ─── Profiles Table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'teacher',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on new user sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─── Classes Table ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS classes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    section TEXT,
    subject TEXT,
    total_items INTEGER DEFAULT 100,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "classes_select_own" ON classes
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "classes_insert_own" ON classes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "classes_update_own" ON classes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "classes_delete_own" ON classes
    FOR DELETE USING (auth.uid() = user_id);


-- ─── Add class_id to answer_keys ────────────────────────────

ALTER TABLE answer_keys ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;
ALTER TABLE answer_keys ADD COLUMN IF NOT EXISTS total_items INTEGER;

-- ─── Add total_items to classes ─────────────────────────────

ALTER TABLE classes ADD COLUMN IF NOT EXISTS total_items INTEGER DEFAULT 100;


-- ─── Add student_name and class_id to scan_results ──────────

ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;


-- ─── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_answer_keys_user ON answer_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_answer_keys_class ON answer_keys(class_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_user ON scan_results(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_class ON scan_results(class_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_created ON scan_results(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_classes_user ON classes(user_id);
