-- 1) Create the printer_models table
CREATE TABLE public.printer_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- fdm or resina
    image_url TEXT,
    tagline TEXT,
    volume TEXT,
    speed TEXT,
    movement TEXT, -- e.g. Bed Slinger, CoreXY
    enclosure TEXT, -- e.g. Open, Closed
    power_print INTEGER,
    power_standby INTEGER,
    power_max INTEGER,
    score_speed INTEGER,
    score_quality INTEGER,
    score_ease INTEGER,
    score_materials INTEGER,
    score_value INTEGER,
    score_eco INTEGER,
    app_name TEXT,
    community TEXT,
    compat_pla BOOLEAN DEFAULT false,
    compat_petg BOOLEAN DEFAULT false,
    compat_abs BOOLEAN DEFAULT false,
    compat_asa BOOLEAN DEFAULT false,
    compat_tpu BOOLEAN DEFAULT false,
    compat_pc BOOLEAN DEFAULT false,
    compat_pa BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies
ALTER TABLE public.printer_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.printer_models FOR SELECT USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.printer_models FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) Alter the existing printers table to copy visual fields from models
ALTER TABLE public.printers
ADD COLUMN image_url TEXT,
ADD COLUMN power_print INTEGER,
ADD COLUMN power_standby INTEGER,
ADD COLUMN power_max INTEGER,
ADD COLUMN catalog_id UUID REFERENCES public.printer_models(id) DEFAULT NULL;

-- 3) Insert Seed Data (Samples)
INSERT INTO public.printer_models (brand, name, type, image_url, tagline, volume, speed, movement, enclosure, power_print, power_standby, power_max, score_speed, score_quality, score_ease, score_materials, score_value, score_eco, app_name, community, compat_pla, compat_petg, compat_abs, compat_asa, compat_tpu, compat_pc, compat_pa)
VALUES
('Creality', 'Ender 3 V3 SE', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/ender3v3se.png', 'A impressora de entrada mais acessível com nivelamento automático', '220x220x250mm', '250mm/s', 'Bed Slinger', 'Open', 95, 6, 350, 62, 78, 98, 55, 96, 75, 'Creality Print', 'High', true, true, false, false, false, false, false),
('Bambu Lab', 'A1 Mini', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/a1mini.png', 'A entrada mais acessível no ecossistema Bambu', '180x180x180mm', '500mm/s', 'Bed Slinger', 'Open', 100, 5, 220, 88, 82, 97, 45, 95, 92, 'Bambu Handy', 'Forte', true, true, false, false, true, false, false),
('Anycubic', 'Kobra X', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/kobrax.png', 'Bed slinger acessível com sistema multi-material ACE Gen2', '260x260x260mm', '600mm/s', 'Bed Slinger', 'Open', 110, 5, 250, 75, 75, 88, 55, 92, 60, 'Anycubic App', 'Growing', true, true, true, true, true, false, false),
('Prusa Research', 'MK4S', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/mk4s.png', 'A nova iteração da impressora 3D mais fiável do mundo', '250x210x220mm', 'Auto', 'Bed Slinger', 'Open', 80, 5, 250, 80, 95, 85, 75, 85, 80, 'Prusa Connect', 'Gigante', true, true, true, true, true, true, true);
