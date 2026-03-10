-- =====================================================
-- CONTROLAGRO - Script de Criação do Banco de Dados
-- Execute este script no SQL Editor do Supabase
-- =====================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABELA: vendedores
-- =====================================================
CREATE TABLE vendedores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: clientes
-- =====================================================
CREATE TABLE clientes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL,
    nome VARCHAR(255) NOT NULL,
    cpf_cnpj VARCHAR(20),
    telefone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    origem VARCHAR(50) NOT NULL CHECK (origem IN ('indicacao', 'visita', 'marketing', 'evento', 'redes-sociais', 'outro', 'porteira')),
    propriedade_nome VARCHAR(255) NOT NULL,
    endereco TEXT NOT NULL,
    cidade VARCHAR(100) NOT NULL,
    estado VARCHAR(2) DEFAULT 'MG',
    area_hectares DECIMAL(10,2),
    culturas_principais TEXT,
    observacoes TEXT,
<<<<<<< HEAD
=======
    lembrete_data DATE,
    lembrete_nota TEXT,
>>>>>>> b4ae741 (feat: Implementa Relatório Gerencial de Vendedores)
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: visitas
-- =====================================================
CREATE TABLE visitas (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL NOT NULL,
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    motivo VARCHAR(50) NOT NULL CHECK (motivo IN ('prospeccao', 'analise', 'suporte', 'posvenda')),
    descricao TEXT NOT NULL,
    foto_url TEXT,
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    status_venda VARCHAR(50) DEFAULT 'sem-venda' CHECK (status_venda IN ('sem-venda', 'prospeccao', 'negociacao', 'fechado', 'perdido')),
    valor_estimado DECIMAL(12,2) DEFAULT 0,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- TABELA: contatos (histórico de contatos com clientes)
-- =====================================================
CREATE TABLE contatos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE NOT NULL,
    vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL NOT NULL,
    data_hora TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resultado VARCHAR(50) NOT NULL CHECK (resultado IN ('sucesso', 'sem-resposta', 'reagendar', 'desistiu')),
    detalhes TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
<<<<<<< HEAD
=======
-- TABELA: plantios (cultivos dos clientes)
-- =====================================================
CREATE TABLE plantios (
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
>>>>>>> b4ae741 (feat: Implementa Relatório Gerencial de Vendedores)
-- ÍNDICES para melhor performance
-- =====================================================
CREATE INDEX idx_clientes_vendedor ON clientes(vendedor_id);
CREATE INDEX idx_clientes_origem ON clientes(origem);
CREATE INDEX idx_clientes_cidade ON clientes(cidade);
<<<<<<< HEAD
=======
CREATE INDEX idx_clientes_lembrete ON clientes(lembrete_data) WHERE lembrete_data IS NOT NULL;
>>>>>>> b4ae741 (feat: Implementa Relatório Gerencial de Vendedores)
CREATE INDEX idx_visitas_cliente ON visitas(cliente_id);
CREATE INDEX idx_visitas_vendedor ON visitas(vendedor_id);
CREATE INDEX idx_visitas_data ON visitas(data_hora DESC);
CREATE INDEX idx_visitas_motivo ON visitas(motivo);
CREATE INDEX idx_visitas_status ON visitas(status_venda);
CREATE INDEX idx_contatos_cliente ON contatos(cliente_id);
CREATE INDEX idx_contatos_vendedor ON contatos(vendedor_id);
CREATE INDEX idx_contatos_data ON contatos(data_hora DESC);
<<<<<<< HEAD
=======
CREATE INDEX idx_plantios_cliente ON plantios(cliente_id);
CREATE INDEX idx_plantios_ativo ON plantios(ativo) WHERE ativo = true;
CREATE INDEX idx_plantios_data ON plantios(data_plantio DESC);
CREATE INDEX idx_plantios_cultura ON plantios(cultura);
>>>>>>> b4ae741 (feat: Implementa Relatório Gerencial de Vendedores)

-- =====================================================
-- FUNÇÃO: Atualizar updated_at automaticamente
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para atualizar updated_at
CREATE TRIGGER update_vendedores_updated_at BEFORE UPDATE ON vendedores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_visitas_updated_at BEFORE UPDATE ON visitas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
<<<<<<< HEAD
=======
CREATE TRIGGER update_plantios_updated_at BEFORE UPDATE ON plantios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
>>>>>>> b4ae741 (feat: Implementa Relatório Gerencial de Vendedores)

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================
ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contatos ENABLE ROW LEVEL SECURITY;
<<<<<<< HEAD
=======
ALTER TABLE plantios ENABLE ROW LEVEL SECURITY;
>>>>>>> b4ae741 (feat: Implementa Relatório Gerencial de Vendedores)

-- Políticas para vendedores (todos podem ver, só admin edita)
CREATE POLICY "Vendedores são visíveis para todos autenticados" ON vendedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Vendedores podem atualizar próprio perfil" ON vendedores FOR UPDATE TO authenticated USING (auth.uid()::text = id::text);

-- Políticas para clientes
CREATE POLICY "Clientes são visíveis para todos autenticados" ON clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Vendedores podem inserir clientes" ON clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Vendedores podem atualizar clientes" ON clientes FOR UPDATE TO authenticated USING (true);

-- Políticas para visitas
CREATE POLICY "Visitas são visíveis para todos autenticados" ON visitas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Vendedores podem inserir visitas" ON visitas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Vendedores podem atualizar próprias visitas" ON visitas FOR UPDATE TO authenticated USING (vendedor_id::text = auth.uid()::text);

-- Políticas para contatos
CREATE POLICY "Contatos são visíveis para todos autenticados" ON contatos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Vendedores podem inserir contatos" ON contatos FOR INSERT TO authenticated WITH CHECK (true);

<<<<<<< HEAD
=======
-- Políticas para plantios
CREATE POLICY "Plantios são visíveis para todos autenticados" ON plantios FOR SELECT TO authenticated USING (true);
CREATE POLICY "Vendedores podem inserir plantios" ON plantios FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Vendedores podem atualizar plantios" ON plantios FOR UPDATE TO authenticated USING (true);

>>>>>>> b4ae741 (feat: Implementa Relatório Gerencial de Vendedores)
-- =====================================================
-- POLÍTICAS PÚBLICAS (para desenvolvimento/teste)
-- Remova em produção se quiser restringir acesso
-- =====================================================
CREATE POLICY "Permitir leitura pública vendedores" ON vendedores FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir leitura pública clientes" ON clientes FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir leitura pública visitas" ON visitas FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir leitura pública contatos" ON contatos FOR SELECT TO anon USING (true);
<<<<<<< HEAD
CREATE POLICY "Permitir inserção pública clientes" ON clientes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Permitir inserção pública visitas" ON visitas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Permitir inserção pública contatos" ON contatos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Permitir atualização pública clientes" ON clientes FOR UPDATE TO anon USING (true);
CREATE POLICY "Permitir atualização pública visitas" ON visitas FOR UPDATE TO anon USING (true);
=======
CREATE POLICY "Permitir leitura pública plantios" ON plantios FOR SELECT TO anon USING (true);
CREATE POLICY "Permitir inserção pública clientes" ON clientes FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Permitir inserção pública visitas" ON visitas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Permitir inserção pública contatos" ON contatos FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Permitir inserção pública plantios" ON plantios FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Permitir atualização pública clientes" ON clientes FOR UPDATE TO anon USING (true);
CREATE POLICY "Permitir atualização pública visitas" ON visitas FOR UPDATE TO anon USING (true);
CREATE POLICY "Permitir atualização pública plantios" ON plantios FOR UPDATE TO anon USING (true);
>>>>>>> b4ae741 (feat: Implementa Relatório Gerencial de Vendedores)

-- =====================================================
-- DADOS INICIAIS: Vendedores da O Fazendeiro
-- =====================================================
INSERT INTO vendedores (nome, email, telefone) VALUES
    ('Carlos Silva', 'carlos@fazendeiro.com', '(31) 99999-1111'),
    ('Ana Santos', 'ana@fazendeiro.com', '(31) 99999-2222'),
    ('Pedro Oliveira', 'pedro@fazendeiro.com', '(31) 99999-3333'),
    ('Maria Costa', 'maria@fazendeiro.com', '(31) 99999-4444');

-- =====================================================
-- VIEW: Estatísticas do Dashboard
-- =====================================================
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT 
    (SELECT COUNT(*) FROM visitas WHERE data_hora >= DATE_TRUNC('month', CURRENT_DATE)) as visitas_mes,
    (SELECT COUNT(*) FROM clientes WHERE ativo = true) as total_clientes,
    (SELECT COALESCE(SUM(valor_estimado), 0) FROM visitas WHERE status_venda = 'negociacao') as valor_negociacao,
    (SELECT 
        CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status_venda = 'fechado')::DECIMAL / COUNT(*)) * 100, 1)
            ELSE 0 
        END
     FROM visitas WHERE status_venda IN ('fechado', 'perdido')) as taxa_conversao;

-- =====================================================
-- VIEW: Visitas com dados completos
-- =====================================================
CREATE OR REPLACE VIEW visitas_completas AS
SELECT 
    v.*,
    c.nome as cliente_nome,
    c.propriedade_nome,
    c.cidade as cliente_cidade,
    c.telefone as cliente_telefone,
    vd.nome as vendedor_nome,
    vd.email as vendedor_email
FROM visitas v
LEFT JOIN clientes c ON v.cliente_id = c.id
LEFT JOIN vendedores vd ON v.vendedor_id = vd.id
ORDER BY v.data_hora DESC;

-- =====================================================
-- VIEW: Performance dos vendedores
-- =====================================================
CREATE OR REPLACE VIEW vendedores_performance AS
SELECT 
    vd.id,
    vd.nome,
    vd.email,
    vd.telefone,
    COUNT(DISTINCT c.id) as total_clientes,
    COUNT(DISTINCT v.id) as total_visitas,
    COUNT(DISTINCT v.id) FILTER (WHERE v.data_hora >= DATE_TRUNC('month', CURRENT_DATE)) as visitas_mes,
    COALESCE(SUM(v.valor_estimado) FILTER (WHERE v.status_venda = 'fechado'), 0) as total_vendas,
    COALESCE(SUM(v.valor_estimado) FILTER (WHERE v.status_venda = 'negociacao'), 0) as em_negociacao
FROM vendedores vd
LEFT JOIN clientes c ON c.vendedor_id = vd.id
LEFT JOIN visitas v ON v.vendedor_id = vd.id
WHERE vd.ativo = true
GROUP BY vd.id, vd.nome, vd.email, vd.telefone;

<<<<<<< HEAD
=======
-- =====================================================
-- VIEW: Agenda - Lembretes dos Clientes
-- =====================================================
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

-- =====================================================
-- VIEW: Agenda - Plantios Ativos
-- =====================================================
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

>>>>>>> b4ae741 (feat: Implementa Relatório Gerencial de Vendedores)
-- Permitir acesso às views
GRANT SELECT ON dashboard_stats TO anon, authenticated;
GRANT SELECT ON visitas_completas TO anon, authenticated;
GRANT SELECT ON vendedores_performance TO anon, authenticated;
<<<<<<< HEAD
=======
GRANT SELECT ON agenda_lembretes TO anon, authenticated;
GRANT SELECT ON agenda_plantios TO anon, authenticated;
>>>>>>> b4ae741 (feat: Implementa Relatório Gerencial de Vendedores)

SELECT 'Script executado com sucesso! Tabelas criadas.' as status;

-- =====================================================
-- MIGRAÇÃO: Adicionar 'porteira' ao CHECK de origem
-- Execute se o banco já existe e precisa dessa correção
-- =====================================================
-- ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_origem_check;
-- ALTER TABLE clientes ADD CONSTRAINT clientes_origem_check
--   CHECK (origem IN ('indicacao', 'visita', 'marketing', 'evento', 'redes-sociais', 'outro', 'porteira'));
