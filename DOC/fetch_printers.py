import json
import time
import os
try:
    from duckduckgo_search import DDGS
except ImportError:
    print("duckduckgo_search not installed.")
    exit(1)

# Lista completa do catálogo anterior
catalog = {
  'Bambu Lab': {
    'fdm': ['X1 Carbon','X1E','P1S','P1P','A1','A1 Mini','A1 Mini Combo']
  },
  'Prusa Research': {
    'fdm': ['MK4','MK4S','Mini+','XL','Core One'],
    'resina': ['SL1S Speed']
  },
  'Creality': {
    'fdm': ['Ender-3 V3 SE','Ender-3 V3 KE','Ender-3 V3','K1','K1C','K1 Max','K2 Plus'],
    'resina': ['Halot Mage Pro']
  },
  'Anycubic': {
    'fdm': ['Kobra 2 Pro','Kobra 2 Max','Kobra 3 Combo','Kobra X'],
    'resina': ['Photon Mono M5s','Photon Mono M7 Pro']
  },
  'Elegoo': {
    'fdm': ['Neptune 4 Pro','Neptune 4 Max','OrangeStorm Giga'],
    'resina': ['Saturn 3 Ultra','Saturn 4 Ultra']
  },
  'QIDI Tech': {
    'fdm': ['X-Max 3','X-Plus 3','Q1 Pro','Plus4']
  },
  'Voron Design': {
    'fdm': ['Voron 0.2','Voron Trident','Voron 2.4']
  }
}

ddgs = DDGS()
results = []

print("🚀 A Iniciar a pesquisa automática de imagens das impressoras...")

for brand, types in catalog.items():
    for typ, models in types.items():
        for model in models:
            query = f"{brand} {model} 3d printer official transparent png"
            print(f"🔎 Pesquisar: {brand} {model}")
            try:
                res = list(ddgs.images(query, max_results=1))
                if res and len(res) > 0:
                    image_url = res[0]['image']
                    results.append({
                        'brand': brand,
                        'name': model,
                        'type': typ,
                        'image_url': image_url
                    })
                    print(f"   ✅ Imagem encontrada")
                else:
                    print("   ❌ Não encontrada.")
            except Exception as e:
                print(f"   ⚠️ Erro na pesquisa: {e}")
            time.sleep(1)

# Gerar o ficheiro SQL Seed
print("\n📝 A gerar Script SQL (seed_all_printers.sql)...")
sql = "-- 🚀 Inserção Automática em Massa das Impressoras 🚀\n"
for r in results:
    sql += f"""
INSERT INTO public.printer_models (brand, name, type, image_url, tagline, power_print)
VALUES ('{r['brand']}', '{r['name']}', '{r['type']}', '{r['image_url']}', 'Modelo da {r['brand']}', 100);
"""

out_path = '/Users/breno.andrade/Documents/Breno/repo/3dzaap-app/DOC/seed_all_printers.sql'
with open(out_path, 'w') as f:
    f.write(sql)
print(f"✅ Concluído com sucesso! Pode verificar o ficheiro: {out_path}")
