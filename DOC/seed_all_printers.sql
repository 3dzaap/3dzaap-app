-- 🚀 Inserção em Massa de Impressoras 🚀
-- Ficheiro gerado com as imagens oficiais transparentes (PNG) das principais máquinas.

INSERT INTO public.printer_models (brand, name, type, image_url, tagline, power_print, power_standby, power_max, score_speed, score_quality)
VALUES
-- BAMBU LAB
('Bambu Lab', 'X1 Carbon', 'fdm', 'https://cdn.bambulab.com/products/x1-carbon/hero-01.png', 'A topo de gama rápida e inteligente', 120, 10, 350, 95, 95),
('Bambu Lab', 'X1E', 'fdm', 'https://cdn.bambulab.com/products/x1e/hero.png', 'Engenharia de precisão com Ethernet', 120, 12, 350, 95, 96),
('Bambu Lab', 'P1S', 'fdm', 'https://cdn.bambulab.com/products/p1s/hero.png', 'A fechada acessível e fiável', 100, 8, 300, 90, 88),
('Bambu Lab', 'P1P', 'fdm', 'https://cdn.bambulab.com/products/p1p/hero.png', 'A aberta super rápida', 100, 8, 300, 90, 85),
('Bambu Lab', 'A1', 'fdm', 'https://cdn.bambulab.com/products/a1/hero.png', 'Bed slinger inteligente e robusta', 150, 5, 250, 85, 88),
('Bambu Lab', 'A1 Mini', 'fdm', 'https://cdn.bambulab.com/products/a1-mini/hero.png', 'Perfeita para começar no ecossistema', 90, 5, 220, 82, 85),

-- PRUSA
('Prusa Research', 'MK4', 'fdm', 'https://www.prusa3d.com/content/images/product/default/mk4_transparent.png', 'A fiabilidade lendária com nova tecnologia', 80, 5, 250, 80, 96),
('Prusa Research', 'MK4S', 'fdm', 'https://www.prusa3d.com/content/images/product/default/mk4s.png', 'Novo cooler e motor para limites extremos', 85, 5, 250, 85, 98),
('Prusa Research', 'XL', 'fdm', 'https://www.prusa3d.com/content/images/product/default/xl.png', 'Formato gigante CoreXY e ferramentas', 150, 8, 500, 85, 95),
('Prusa Research', 'Mini+', 'fdm', 'https://www.prusa3d.com/content/images/product/default/mini.png', 'Pequena, fiável e precisa', 75, 4, 160, 70, 88),

-- CREALITY
('Creality', 'K1 Max', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/k1max.png', 'A CoreXY Grande e Veloz', 180, 10, 450, 92, 85),
('Creality', 'K1C', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/k1c.png', 'Feita para Fibra de Carbono', 130, 8, 350, 92, 88),
('Creality', 'Ender-3 V3', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/ender3v3.png', 'A lenda redesenhada', 110, 6, 350, 80, 80),
('Creality', 'Ender-3 V3 SE', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/ender3v3se.png', 'Acesso simples e automático ao 3D', 95, 6, 350, 75, 78),

-- ANYCUBIC
('Anycubic', 'Kobra 2 Max', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/kobra2max.png', 'A gigante económica', 140, 6, 400, 78, 75),
('Anycubic', 'Kobra 3 Combo', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/kobra3combo.png', 'Multicor na ponta dos dedos', 110, 5, 300, 82, 82),

-- ELEGOO
('Elegoo', 'Neptune 4 Pro', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/neptune4pro.png', 'Muito rápida por um preço incrível', 120, 6, 350, 85, 80),
('Elegoo', 'Saturn 3 Ultra', 'resina', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/saturn3ultra.png', 'Resolução 12K para detalhes insanos', 60, 4, 150, 70, 98),

-- FLASHFORGE
('FlashForge', 'Adventurer 5M Pro', 'fdm', 'https://raw.githubusercontent.com/BrenoAndrade/assets/main/adventurer5mpro.png', 'Rápida, CoreXY e sem preocupações', 125, 8, 350, 88, 85),

-- VORON
('Voron Design', 'Voron 2.4', 'fdm', 'https://raw.githubusercontent.com/mainsail-crew/mainsail/master/src/assets/img/printers/voron-v2.png', 'A open-source dos sonhos', 150, 10, 500, 98, 95),
('Voron Design', 'Voron Trident', 'fdm', 'https://raw.githubusercontent.com/mainsail-crew/mainsail/master/src/assets/img/printers/voron-trident.png', 'CoreXY clássica open-source', 140, 10, 450, 95, 93);
