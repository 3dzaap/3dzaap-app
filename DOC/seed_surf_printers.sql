-- =====================================================
-- NOVO CATÁLOGO GLOBAL DE MÁQUINAS - EXTRAÇÃO REAL IMPRESSAO3D.SURF
-- 22 Máquinas Curadas com Consumos Elétricos e Imagems Originais Cloudfront
-- =====================================================

INSERT INTO public.printer_models 
(brand, name, type, image_url, power_print, power_standby, power_max)
VALUES
('Creality', 'Ender 3 V3 SE', 'fdm', 'images/printers/surf_real_ender_3_v3_se.webp', 95, 6, 350),
('Bambu Lab', 'A1 Mini', 'fdm', 'images/printers/surf_real_a1_mini.webp', 100, 5, 220),
('Anycubic', 'Kobra X', 'fdm', 'images/printers/surf_real_kobra_x.webp', 110, 5, 250),
('Flashforge', 'Adventurer 5M', 'fdm', 'images/printers/surf_real_adventurer_5m.webp', 110, 7, 350),
('Bambu Lab', 'A1', 'fdm', 'images/printers/surf_real_a1.webp', 140, 6, 350),
('Anycubic', 'Kobra 3 V2', 'fdm', 'images/printers/surf_real_kobra_3_v2.webp', 130, 8, 350),
('Creality', 'Hi Combo', 'fdm', 'images/printers/surf_real_hi_combo.webp', 165, 8, 350),
('Flashforge', 'AD5X', 'fdm', 'images/printers/surf_real_ad5x.webp', 120, 8, 350),
('Creality', 'K2', 'fdm', 'images/printers/surf_real_k2.webp', 200, 10, 500),
('Bambu Lab', 'P2S', 'fdm', 'images/printers/surf_real_p2s.webp', 175, 10, 400),
('Bambu Lab', 'P1P', 'fdm', 'images/printers/surf_real_p1p.webp', 150, 8, 350),
('Bambu Lab', 'P1S', 'fdm', 'images/printers/surf_real_p1s.webp', 160, 10, 350),
('Prusa Research', 'MK4S', 'fdm', 'images/printers/surf_real_mk4s.webp', 120, 8, 240),
('Snapmaker', 'U1', 'fdm', 'images/printers/surf_real_u1.webp', 240, 12, 450),
('Bambu Lab', 'H2S', 'fdm', 'images/printers/surf_real_h2s.webp', 280, 15, 500),
('Bambu Lab', 'X1 Carbon', 'fdm', 'images/printers/surf_real_x1_carbon.webp', 110, 9, 350),
('Prusa Research', 'Core One', 'fdm', 'images/printers/surf_real_core_one.webp', 130, 8, 250),
('Creality', 'K2 Plus', 'fdm', 'images/printers/surf_real_k2_plus.webp', 350, 15, 750),
('Prusa Research', 'Core One L', 'fdm', 'images/printers/surf_real_core_one_l.webp', 200, 12, 400),
('Bambu Lab', 'H2D', 'fdm', 'images/printers/surf_real_h2d.webp', 350, 20, 650),
('Bambu Lab', 'H2C', 'fdm', 'images/printers/surf_real_h2c.webp', 320, 18, 600),
('Prusa Research', 'XL', 'fdm', 'images/printers/surf_real_xl.webp', 420, 25, 800)
ON CONFLICT (brand, name, type)
DO UPDATE SET 
    image_url = EXCLUDED.image_url,
    power_print = EXCLUDED.power_print,
    power_standby = EXCLUDED.power_standby,
    power_max = EXCLUDED.power_max;
