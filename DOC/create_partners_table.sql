CREATE TABLE IF NOT EXISTS partners (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  ref_code TEXT UNIQUE NOT NULL,
  stripe_coupon_id TEXT, -- Pode ser NULL se não tiver desconto para os indicados
  reward_rule TEXT,      -- Descrição da regra (ex: "1 ano grátis a cada 10 indicações")
  referral_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exemplo de como inserir um parceiro:
-- INSERT INTO partners (name, ref_code, stripe_coupon_id, reward_rule)
-- VALUES ('DI3D', 'di3d', 'ID_DO_CUPOM_AQUI', '1 ano grátis a cada 10 indicações');
