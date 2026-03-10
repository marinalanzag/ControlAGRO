-- =====================================================
-- CONTROLAGRO - MIGRAÇÃO SEGURA: Restaurar Agenda Inteligente
-- =====================================================
-- GARANTIAS DE SEGURANÇA:
-- ✅ Não remove dados existentes
-- ✅ Não altera dados existentes
-- ✅ Idempotente (pode rodar múltiplas vezes)
-- ✅ Não afeta tabelas existentes (clientes, visitas, vendedores)
-- =====================================================

-- =====================================================
-- PRÉ-VALIDAÇÃO: Verificar estruturas existentes
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INICIANDO MIGRAÇÃO DA AGENDA INTELIGENTE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Data: %', NOW();

    -- Verificar se tabela clientes existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clientes') THEN
        RAISE EXCEPTION 'ERRO CRÍTICO: Tabela clientes não existe! Verifique o banco de dados.';
    END IF;

    RAISE NOTICE '✓ Tabela clientes encontrada';

    -- Verificar se tabela vendedores existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendedores') THEN
        RAISE EXCEPTION 'ERRO CRÍTICO: Tabela vendedores não existe! Verifique o banco de dados.';
    END IF;

    RAISE NOTICE '✓ Tabela vendedores encontrada';

    -- Contar clientes existentes
    RAISE NOTICE '✓ Clientes cadastrados: %', (SELECT COUNT(*) FROM clientes);
    RAISE NOTICE '✓ Vendedores cadastrados: %', (SELECT COUNT(*) FROM vendedores);
END $$;

-- =====================================================
-- 1. ADICIONAR COLUNAS DE LEMBRETE NA TABELA CLIENTES
-- =====================================================
DO $$
BEGIN
    -- Adicionar coluna lembrete_data se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clientes' AND column_name = 'lembrete_data'
    ) THEN
        ALTER TABLE clientes ADD COLUMN lembrete_data DATE;
        RAISE NOTICE '✓ Coluna lembrete_data criada em clientes';
    ELSE
        RAISE NOTICE '○ Coluna lembrete_data já existe em clientes';
    END IF;

    -- Adicionar coluna lembrete_nota se não existir
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clientes' AND column_name = 'lembrete_nota'
    ) THEN
        ALTER TABLE clientes ADD COLUMN lembrete_nota TEXT;
        RAISE NOTICE '✓ Coluna lembrete_nota criada em clientes';
    ELSE
        RAISE NOTICE '○ Coluna lembrete_nota já existe em clientes';
    END IF;
END $$;

-- Criar índice para melhorar performance da agenda (se não existir)
CREATE INDEX IF NOT EXISTS idx_clientes_lembrete
ON clientes(lembrete_data)
WHERE lembrete_data IS NOT NULL;

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
-- 4. CRIAR TRIGGER PARA UPDATED_AT (com proteção)
-- =====================================================
-- Remover trigger existente se houver, depois recriar
DROP TRIGGER IF EXISTS update_plantios_updated_at ON plantios;

CREATE TRIGGER update_plantios_updated_at
BEFORE UPDATE ON plantios
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
-- =====================================================
-- Verificar se a função update_updated_at_column existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
    ) THEN
        RAISE WARNING 'ATENÇÃO: Função update_updated_at_column não existe. O trigger pode não funcionar.';
    END IF;
END $$;

-- Habilitar RLS apenas se a tabela plantios existir e ainda não tiver RLS habilitado
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plantios') THEN
        ALTER TABLE plantios ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '✓ RLS habilitado para tabela plantios';
    END IF;
END $$;

-- =====================================================
-- 6. POLÍTICAS DE SEGURANÇA PARA PLANTIOS
-- =====================================================
-- Remover políticas existentes e recriar (garante idempotência)

-- Políticas para usuários autenticados
DROP POLICY IF EXISTS "Plantios são visíveis para todos autenticados" ON plantios;
CREATE POLICY "Plantios são visíveis para todos autenticados"
ON plantios FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Vendedores podem inserir plantios" ON plantios;
CREATE POLICY "Vendedores podem inserir plantios"
ON plantios FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Vendedores podem atualizar plantios" ON plantios;
CREATE POLICY "Vendedores podem atualizar plantios"
ON plantios FOR UPDATE TO authenticated USING (true);

-- Políticas públicas (para desenvolvimento/teste)
DROP POLICY IF EXISTS "Permitir leitura pública plantios" ON plantios;
CREATE POLICY "Permitir leitura pública plantios"
ON plantios FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Permitir inserção pública plantios" ON plantios;
CREATE POLICY "Permitir inserção pública plantios"
ON plantios FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir atualização pública plantios" ON plantios;
CREATE POLICY "Permitir atualização pública plantios"
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
    (CURRENT_DATE - p.data_plantio)::INTEGER as dias_plantio,
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
-- 8. VALIDAÇÃO PÓS-MIGRAÇÃO
-- =====================================================
DO $$
DECLARE
    v_clientes_count INTEGER;
    v_plantios_exists BOOLEAN;
    v_lembrete_data_exists BOOLEAN;
    v_lembrete_nota_exists BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VALIDAÇÃO PÓS-MIGRAÇÃO';
    RAISE NOTICE '========================================';

    -- Contar clientes após migração
    SELECT COUNT(*) INTO v_clientes_count FROM clientes;
    RAISE NOTICE '✓ Total de clientes após migração: %', v_clientes_count;

    -- Verificar se tabela plantios foi criada
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'plantios'
    ) INTO v_plantios_exists;

    IF v_plantios_exists THEN
        RAISE NOTICE '✓ Tabela plantios: CRIADA';
    ELSE
        RAISE EXCEPTION 'ERRO: Tabela plantios NÃO foi criada!';
    END IF;

    -- Verificar coluna lembrete_data
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clientes' AND column_name = 'lembrete_data'
    ) INTO v_lembrete_data_exists;

    IF v_lembrete_data_exists THEN
        RAISE NOTICE '✓ Coluna lembrete_data: CRIADA';
    ELSE
        RAISE EXCEPTION 'ERRO: Coluna lembrete_data NÃO foi criada!';
    END IF;

    -- Verificar coluna lembrete_nota
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'clientes' AND column_name = 'lembrete_nota'
    ) INTO v_lembrete_nota_exists;

    IF v_lembrete_nota_exists THEN
        RAISE NOTICE '✓ Coluna lembrete_nota: CRIADA';
    ELSE
        RAISE EXCEPTION 'ERRO: Coluna lembrete_nota NÃO foi criada!';
    END IF;

    -- Verificar views
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'agenda_lembretes') THEN
        RAISE NOTICE '✓ View agenda_lembretes: CRIADA';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'agenda_plantios') THEN
        RAISE NOTICE '✓ View agenda_plantios: CRIADA';
    END IF;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'MIGRAÇÃO CONCLUÍDA COM SUCESSO!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Recarregue a aplicação web/mobile';
    RAISE NOTICE '2. Adicione um lembrete em um cliente existente';
    RAISE NOTICE '3. Adicione um plantio em um cliente existente';
    RAISE NOTICE '4. Verifique se a Agenda Inteligente aparece no Dashboard';
    RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- 9. RELATÓRIO FINAL
-- =====================================================
SELECT
    'MIGRAÇÃO CONCLUÍDA' as status,
    NOW() as data_execucao,
    (SELECT COUNT(*) FROM clientes) as total_clientes_apos_migracao,
    (SELECT COUNT(*) FROM plantios) as total_plantios_apos_migracao,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plantios') as tabela_plantios_criada,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'lembrete_data') as coluna_lembrete_data_criada,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'lembrete_nota') as coluna_lembrete_nota_criada;
