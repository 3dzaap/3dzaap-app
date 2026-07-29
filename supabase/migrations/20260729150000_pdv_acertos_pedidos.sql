-- 1. Link Orders and PDV Requests
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pdv_request_id uuid REFERENCES pdv_requests(id) ON DELETE SET NULL;
ALTER TABLE pdv_requests ADD COLUMN IF NOT EXISTS order_id uuid REFERENCES orders(id) ON DELETE SET NULL;

-- 2. PDV Settlement settings
ALTER TABLE pdvs ADD COLUMN IF NOT EXISTS settlement_frequency text DEFAULT 'mensal';
ALTER TABLE pdvs ADD COLUMN IF NOT EXISTS next_settlement_date date;

-- 3. Settlement tracking table
CREATE TABLE IF NOT EXISTS pdv_settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  pdv_id uuid REFERENCES pdvs(id) ON DELETE CASCADE,
  amount numeric NOT NULL, -- The final amount to receive
  commission_amount numeric NOT NULL,
  total_sales numeric NOT NULL,
  settled_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- RLS for pdv_settlements
ALTER TABLE pdv_settlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their company pdv settlements" ON pdv_settlements FOR SELECT USING (
  company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid())
);
CREATE POLICY "Users can insert their company pdv settlements" ON pdv_settlements FOR INSERT WITH CHECK (
  company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid())
);
CREATE POLICY "Users can update their company pdv settlements" ON pdv_settlements FOR UPDATE USING (
  company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid())
);
CREATE POLICY "Users can delete their company pdv settlements" ON pdv_settlements FOR DELETE USING (
  company_id IN (SELECT company_id FROM memberships WHERE user_id = auth.uid())
);
