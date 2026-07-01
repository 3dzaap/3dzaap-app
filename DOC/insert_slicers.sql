-- Script para popular a base de dados com os parâmetros detalhados de cada Slicer
-- Insira no SQL Editor do Supabase e execute.

INSERT INTO public.slicer_schemas (name, schema_json) VALUES 

('Bambu Studio', '{
  "Quality": [
    "Layer height",
    "Initial layer height",
    "Line width",
    "Seam position"
  ],
  "Strength": [
    "Wall loops",
    "Top shell layers",
    "Bottom shell layers",
    "Sparse infill density",
    "Sparse infill pattern",
    "Infill combination"
  ],
  "Speed": [
    "Initial layer speed",
    "Outer wall speed",
    "Inner wall speed",
    "Sparse infill speed",
    "Travel speed",
    "Acceleration (normal/outer wall)"
  ],
  "Support": [
    "Enable support",
    "Support type (normal/tree)",
    "Top Z distance",
    "Bottom Z distance",
    "Support interface"
  ],
  "Cooling": [
    "Min print speed",
    "Fan speed",
    "Bridge fan speed"
  ]
}'::jsonb),

('Orca Slicer', '{
  "Quality": [
    "Layer height",
    "Initial layer height",
    "Line width",
    "Seam position",
    "Precision / Resolution"
  ],
  "Strength": [
    "Wall loops",
    "Top surface skin layers",
    "Bottom surface skin layers",
    "Sparse infill density",
    "Sparse infill pattern",
    "Infill/wall overlap"
  ],
  "Speed": [
    "First layer speed",
    "Outer wall speed",
    "Inner wall speed",
    "Infill speed",
    "Travel speed",
    "Acceleration"
  ],
  "Support": [
    "Enable support",
    "Support style",
    "Top Z distance",
    "Bottom Z distance",
    "Support interface pattern"
  ],
  "Cooling": [
    "Fan speed",
    "Overhang fan speed",
    "Min print speed"
  ]
}'::jsonb),

('UltiMaker Cura', '{
  "Quality": [
    "Layer Height",
    "Initial Layer Height",
    "Line Width"
  ],
  "Walls": [
    "Wall Thickness",
    "Wall Line Count",
    "Horizontal Expansion",
    "Z Seam Alignment"
  ],
  "Top/Bottom": [
    "Top Thickness",
    "Bottom Thickness",
    "Top/Bottom Pattern"
  ],
  "Infill": [
    "Infill Density",
    "Infill Pattern",
    "Infill Overlap"
  ],
  "Material": [
    "Printing Temperature",
    "Build Plate Temperature",
    "Flow",
    "Retraction Distance",
    "Retraction Speed"
  ],
  "Speed": [
    "Print Speed",
    "Infill Speed",
    "Wall Speed",
    "Travel Speed",
    "Initial Layer Speed"
  ],
  "Travel": [
    "Enable Retraction",
    "Z Hop When Retracted",
    "Combing Mode"
  ],
  "Cooling": [
    "Enable Print Cooling",
    "Fan Speed"
  ],
  "Support": [
    "Generate Support",
    "Support Placement",
    "Support Overhang Angle",
    "Support Density"
  ]
}'::jsonb),

('PrusaSlicer', '{
  "Layers and Perimeters": [
    "Layer height",
    "First layer height",
    "Perimeters",
    "Solid layers (Top/Bottom)",
    "Seam position"
  ],
  "Infill": [
    "Fill density",
    "Fill pattern",
    "Top/bottom fill pattern",
    "Combine infill every"
  ],
  "Skirt and Brim": [
    "Loops (minimum)",
    "Distance from object",
    "Brim width"
  ],
  "Support Material": [
    "Generate support material",
    "Overhang threshold",
    "Contact Z distance",
    "Pattern spacing",
    "Interface layers"
  ],
  "Speed": [
    "Perimeters",
    "Small perimeters",
    "External perimeters",
    "Infill",
    "Solid infill",
    "Top solid infill",
    "Travel",
    "First layer speed"
  ]
}'::jsonb),

('Anycubic Slicer Next', '{
  "Quality": [
    "Layer height",
    "Initial layer height",
    "Line width"
  ],
  "Strength": [
    "Wall loops",
    "Top layers",
    "Bottom layers",
    "Infill density",
    "Infill pattern"
  ],
  "Speed": [
    "Print speed",
    "Initial layer speed",
    "Wall speed",
    "Travel speed"
  ],
  "Support": [
    "Generate support",
    "Support placement",
    "Support overhang angle",
    "Z distance"
  ],
  "Cooling": [
    "Enable print cooling",
    "Fan speed"
  ]
}'::jsonb),

('FlashPrint', '{
  "General": [
    "Layer Height",
    "First Layer Height",
    "Base Print Speed",
    "Travel Speed"
  ],
  "Shells": [
    "Perimeter Shells",
    "Top Solid Layers",
    "Bottom Solid Layers"
  ],
  "Infill": [
    "Fill Density",
    "Fill Pattern",
    "Combine Infill"
  ],
  "Supports": [
    "Enable Support",
    "Support Type (Linear/Treelike)",
    "Post-Spacing"
  ],
  "Cooling": [
    "Cooling Fan Status"
  ]
}'::jsonb),

('Luban (Snapmaker)', '{
  "Quality": [
    "Layer height",
    "Initial layer height"
  ],
  "Shell": [
    "Wall Thickness",
    "Wall Line Count",
    "Top Thickness",
    "Bottom Thickness"
  ],
  "Infill": [
    "Infill Density",
    "Infill Pattern"
  ],
  "Speed": [
    "Print Speed",
    "Travel Speed",
    "Initial Layer Speed"
  ],
  "Support": [
    "Generate Support",
    "Support Overhang Angle"
  ]
}'::jsonb)

ON CONFLICT (name) DO UPDATE 
SET schema_json = EXCLUDED.schema_json,
    created_at = NOW();
