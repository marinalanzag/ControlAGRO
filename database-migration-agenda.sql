-- =====================================================
-- CONTROLAGRO - MIGRAÇÃO: Restaurar Agenda Inteligente
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- =====================================================
-- 1. ADICIONAR COLUNAS DE LEMBRETE NA TABELA CLIENTES
-- =====================================================
ALTER TABLE clientes
ADD COLUMN IF NOT EXISTS lembrete_data DATE,
ADD COLUMN IF NOT EXISTS lembrete_nota TEXT;

-- Criar índice para melhorar performance da agenda
CREATE INDEX IF NOT EXISTS idx_clientes_lembrete ON clientes(lembrete_data) WHERE lembrete_data IS NOT NULL;

-- =====================================================
-- 2. CRIAR TABELA PLANTIOS
-- =====================================================
CREATE TABLE IF NOT EXISTS plantios (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    cultura VARCHAR(100) NOT NULL CHECK (cultura IN ('Soja', 'Milho', 'Grãos', 'Silagem', 'Outro')),
    tipo VARCHAR(50) DEFAULT 'Safra' CHECK (tipo IN ('Safra', 'Safrinha', 'Teste')),
    data_plantio DATE NOT NULL,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. CRIAR ÍNDICES PARA PLANTIOS
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_plantios_cliente ON plantios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_plantios_ativo ON plantios(ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_plantios_data ON plantios(data_plantio DESC);
CREATE INDEX IF NOT EXISTS idx_plantios_cultura ON plantios(cultura);

-- =====================================================
-- 4. CRIAR TRIGGER PARA UPDATED_AT
-- =====================================================
CREATE TRIGGER IF NOT EXISTS update_plantios_updated_at
BEFORE UPDATE ON plantios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE plantios ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. POLÍTICAS DE SEGURANÇA PARA PLANTIOS
-- =====================================================
-- Políticas para usuários autenticados
CREATE POLICY IF NOT EXISTS "Plantios são visíveis para todos autenticados"
ON plantios FOR SELECT TO authenticated USING (true);

CREATE POLICY IF NOT EXISTS "Vendedores podem inserir plantios"
ON plantios FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Vendedores podem atualizar plantios"
ON plantios FOR UPDATE TO authenticated USING (true);

-- Políticas públicas (para desenvolvimento/teste)
-- Remova em produção se quiser restringir acesso
CREATE POLICY IF NOT EXISTS "Permitir leitura pública plantios"
ON plantios FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "Permitir inserção pública plantios"
ON plantios FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Permitir atualização pública plantios"
ON plantios FOR UPDATE TO anon USING (true);

-- =====================================================
-- 7. VIEWS PARA AGENDA INTELIGENTE
-- =====================================================

-- View: Clientes com lembretes ativos
CREATE OR REPLACE VIEW agenda_lembretes AS
SELECT
    c.id as cliente_id,
    c.nome as cliente_nome,
    c.propriedade_nome,
    c.cidade,
    c.lembrete_data,
    c.lembrete_nota,
    c.vendedor_id,
    v.nome as vendedor_nome,
    CASE
        WHEN c.lembrete_data < CURRENT_DATE THEN 'ATRASADO'
        WHEN c.lembrete_data = CURRENT_DATE THEN 'HOJE'
        WHEN c.lembrete_data <= CURRENT_DATE + INTERVAL '7 days' THEN 'FUTURO'
        ELSE 'FUTURO_DISTANTE'
    END as status_lembrete
FROM clientes c
LEFT JOIN vendedores v ON c.vendedor_id = v.id
WHERE c.ativo = true
  AND c.lembrete_data IS NOT NULL
ORDER BY c.lembrete_data ASC;

-- View: Plantios ativos com estágio calculado
CREATE OR REPLACE VIEW agenda_plantios AS
SELECT
    p.id as plantio_id,
    p.cliente_id,
    c.nome as cliente_nome,
    c.propriedade_nome,
    c.cidade,
    p.cultura,
    p.tipo,
    p.data_plantio,
    EXTRACT(DAY FROM (CURRENT_DATE - p.data_plantio)) as dias_plantio,
    c.vendedor_id,
    v.nome as vendedor_nome
FROM plantios p
LEFT JOIN clientes c ON p.cliente_id = c.id
LEFT JOIN vendedores v ON c.vendedor_id = v.id
WHERE p.ativo = true
  AND c.ativo = true
  AND p.data_plantio <= CURRENT_DATE
ORDER BY p.data_plantio DESC;

-- Permitir acesso às views
GRANT SELECT ON agenda_lembretes TO anon, authenticated;
GRANT SELECT ON agenda_plantios TO anon, authenticated;

-- =====================================================
-- 8. VERIFICAÇÃO FINAL
-- =====================================================
SELECT 'Migração executada com sucesso!' as status,
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plantios') as tabela_plantios_criada,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'lembrete_data') as coluna_lembrete_data_criada,
       EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'lembrete_nota') as coluna_lembrete_nota_criada;
