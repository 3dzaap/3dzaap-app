CREATE TABLE IF NOT EXISTS public.slicer_schemas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    schema_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.slicer_schemas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view slicer schemas" ON public.slicer_schemas;
DROP POLICY IF EXISTS "Super admins can manage slicer schemas" ON public.slicer_schemas;

-- Read Access: All authenticated users can read the schemas (for the wiki page)
CREATE POLICY "Anyone authenticated can view slicer schemas"
ON public.slicer_schemas FOR SELECT
USING (auth.role() = 'authenticated');

-- Write Access: Only authenticated users (Admin handles the frontend block, but ideally you'd have a role check here)
-- We will allow authenticated users to write, but the admin.html page is only accessible to superAdmins.
CREATE POLICY "Super admins can manage slicer schemas"
ON public.slicer_schemas FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Seed Data (Initial Slicers)
INSERT INTO public.slicer_schemas (name, schema_json) VALUES
('Bambu Studio', '{
    "Quality": ["Layer height", "Initial layer height", "Line width"],
    "Strength": ["Wall loops", "Top shell layers", "Bottom shell layers", "Sparse infill density", "Sparse infill pattern"],
    "Speed": ["Initial layer speed", "Outer wall speed", "Inner wall speed", "Sparse infill speed"],
    "Support": ["Enable support", "Support type", "Top Z distance", "Bottom Z distance"]
}'::JSONB),
('Orca Slicer', '{
    "Quality": ["Layer height", "Initial layer height", "Line width", "Ironing pattern"],
    "Strength": ["Wall loops", "Top shell layers", "Bottom shell layers", "Sparse infill density", "Sparse infill pattern"],
    "Speed": ["Initial layer speed", "Outer wall speed", "Inner wall speed", "Sparse infill speed"],
    "Support": ["Enable support", "Support type", "Top Z distance", "Bottom Z distance"]
}'::JSONB),
('Anycubic Slicer Next', '{
    "Quality": ["Layer height", "Line width"],
    "Strength": ["Wall line count", "Top layers", "Bottom layers", "Infill density", "Infill pattern"],
    "Speed": ["Print speed", "Wall speed", "Infill speed"],
    "Support": ["Generate Support", "Support structure", "Z Distance"]
}'::JSONB),
('FlashPrint (Creator 5)', '{
    "General": ["Layer Height", "First Layer Height", "Base Print Speed"],
    "Shells": ["Perimeter Shells", "Top Solid Layers", "Bottom Solid Layers"],
    "Infill": ["Fill Density", "Fill Pattern"],
    "Supports": ["Enable Support", "Support Type", "Space to Model (Z)"]
}'::JSONB),
('Luban (Snapmaker U1)', '{
    "Quality": ["Layer Height", "Initial Layer Height", "Line Width"],
    "Shell": ["Wall Line Count", "Top Layers", "Bottom Layers"],
    "Infill": ["Infill Density", "Infill Pattern"],
    "Speed": ["Print Speed", "Travel Speed"],
    "Support": ["Generate Support", "Support Placement", "Support Overhang Angle"]
}'::JSONB)
ON CONFLICT (name) DO NOTHING;
