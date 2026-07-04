-- 🚀 Atualização (UPDATE) Automática das Impressoras 2026 com as novas Imagens 🚀
-- Corre individualmente cada modelo pelo nome e marca para garantir que atualiza os registos que já existiam na tabela.

-- Bambu Lab
UPDATE public.printer_models SET image_url = 'images/printers/bambu_lab_x2D.jpeg', power_print = 300, power_standby = 15, power_max = 1000 WHERE brand = 'Bambu Lab' AND name = 'X2D';
UPDATE public.printer_models SET image_url = 'images/printers/bambu_lab_p2s.jpeg', power_print = 250, power_standby = 10, power_max = 1000 WHERE brand = 'Bambu Lab' AND name = 'P2S';
UPDATE public.printer_models SET image_url = 'images/printers/bambu_lab_a2l.jpg', power_print = 200, power_standby = 10, power_max = 800 WHERE brand = 'Bambu Lab' AND name = 'A2L';

-- Elegoo
UPDATE public.printer_models SET image_url = 'images/printers/elegoo_centuri_carbon_2.jpg', power_print = 250, power_standby = 15, power_max = 800 WHERE brand = 'Elegoo' AND name = 'Centauri Carbon 2';
UPDATE public.printer_models SET image_url = 'images/printers/elegoo_centauri_carbon.webp', power_print = 150, power_standby = 10, power_max = 400 WHERE brand = 'Elegoo' AND name = 'Centauri 2';
UPDATE public.printer_models SET image_url = '', power_print = 180, power_standby = 15, power_max = 400 WHERE brand = 'Elegoo' AND name = 'Centauri 2 Combo';
UPDATE public.printer_models SET image_url = 'images/printers/elegoo_jupiter_2.jpg', power_print = 100, power_standby = 15, power_max = 150 WHERE brand = 'Elegoo' AND name = 'Jupiter 2';
UPDATE public.printer_models SET image_url = 'images/printers/elegoo_saturn_4_ultra_16K-.jpg', power_print = 80, power_standby = 10, power_max = 100 WHERE brand = 'Elegoo' AND name = 'Saturn 4 Ultra (16K)';

-- FlashForge
UPDATE public.printer_models SET image_url = 'images/printers/flashforge_Creator_5.jpg', power_print = 350, power_standby = 20, power_max = 1200 WHERE brand = 'FlashForge' AND name = 'Creator 5';
UPDATE public.printer_models SET image_url = 'images/printers/flashforge_Creator_5_pro.jpg', power_print = 400, power_standby = 25, power_max = 1500 WHERE brand = 'FlashForge' AND name = 'Creator 5 Pro';
UPDATE public.printer_models SET image_url = 'images/printers/elegoo_ad5x.jpg', power_print = 200, power_standby = 15, power_max = 800 WHERE brand = 'FlashForge' AND name = 'AD5X';

-- QIDI Tech
UPDATE public.printer_models SET image_url = 'images/printers/qidi3d_Q2.jpeg', power_print = 300, power_standby = 15, power_max = 1000 WHERE brand = 'QIDI Tech' AND name = 'Q2';
UPDATE public.printer_models SET image_url = 'images/printers/qidi3d_q2c.jpeg', power_print = 300, power_standby = 15, power_max = 1000 WHERE brand = 'QIDI Tech' AND name = 'Q2C Combo';
UPDATE public.printer_models SET image_url = 'images/printers/qidi_max_4.png', power_print = 500, power_standby = 20, power_max = 1500 WHERE brand = 'QIDI Tech' AND name = 'Max4';
UPDATE public.printer_models SET image_url = 'images/printers/qidi3d_plus4.webp', power_print = 350, power_standby = 15, power_max = 1200 WHERE brand = 'QIDI Tech' AND name = 'Plus4';

-- Creality
UPDATE public.printer_models SET image_url = 'images/printers/creality_k2 Pro.webp', power_print = 350, power_standby = 15, power_max = 1000 WHERE brand = 'Creality' AND name = 'K2 Pro';
UPDATE public.printer_models SET image_url = 'images/printers/creality_SparkX_i7.webp', power_print = 200, power_standby = 10, power_max = 800 WHERE brand = 'Creality' AND name = 'SparkX i7';

-- Anycubic
UPDATE public.printer_models SET image_url = 'images/printers/anycubic_photon_mono_m7_max', power_print = 90, power_standby = 10, power_max = 120 WHERE brand = 'Anycubic' AND name = 'Photon Mono M7 Max';
