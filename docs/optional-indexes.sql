-- İSTEĞE BAĞLI performans indeksleri (Supabase SQL Editor'da çalıştırılır; güvenli, tekrar çalıştırılabilir).
CREATE INDEX IF NOT EXISTS work_records_team_kind_created_idx ON public.work_records (team_id, kind, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_customer_date_idx ON public.transactions (customer_id, occurred_on DESC);
CREATE INDEX IF NOT EXISTS expenses_occurred_idx ON public.expenses (occurred_on DESC);
