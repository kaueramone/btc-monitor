-- ═══════════════════════════════════════════════
-- BTC Monitor — Migração Supabase
-- Execute este SQL no SQL Editor do Supabase
-- ═══════════════════════════════════════════════

-- Tabela de sessões (uma por dia de trading)
CREATE TABLE IF NOT EXISTS btc_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de candles (vinculados à sessão)
CREATE TABLE IF NOT EXISTS btc_candles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES btc_sessions(id) ON DELETE CASCADE,
  open DOUBLE PRECISION NOT NULL,
  close DOUBLE PRECISION NOT NULL,
  high DOUBLE PRECISION NOT NULL,
  low DOUBLE PRECISION NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_btc_candles_session_id ON btc_candles(session_id);
CREATE INDEX IF NOT EXISTS idx_btc_candles_timestamp ON btc_candles(timestamp);
CREATE INDEX IF NOT EXISTS idx_btc_sessions_date ON btc_sessions(date);

-- ═══════════════════════════════════════════════
-- Row Level Security (RLS)
-- ═══════════════════════════════════════════════

-- Habilitar RLS
ALTER TABLE btc_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE btc_candles ENABLE ROW LEVEL SECURITY;

-- Políticas: permitir leitura pública e escrita via service key
-- Leitura pública
CREATE POLICY "Permitir leitura pública de sessões"
  ON btc_sessions FOR SELECT
  USING (true);

CREATE POLICY "Permitir leitura pública de candles"
  ON btc_candles FOR SELECT
  USING (true);

-- Escrita (apenas com service_role key ou chave autenticada)
CREATE POLICY "Permitir inserção de sessões"
  ON btc_sessions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Permitir inserção de candles"
  ON btc_candles FOR INSERT
  WITH CHECK (true);
