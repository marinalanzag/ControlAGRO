-- =====================================================
-- CONTROLAGRO - RELATÓRIO GERENCIAL DE VENDEDORES
-- =====================================================
-- GARANTIAS:
-- ✅ Sem multiplicação cartesiana (subqueries agregadas)
-- ✅ Métricas matematicamente corretas
-- ✅ Performance otimizada com índices existentes
-- ✅ Compatível com dados existentes
-- =====================================================

-- =====================================================
-- VIEW: relatorio_vendedores (CORRIGIDA)
-- =====================================================
-- Esta view consolida todas as métricas de desempenho
-- por vendedor usando subqueries para evitar duplicação
-- =====================================================

CREATE OR REPLACE VIEW relatorio_vendedores AS
SELECT
    v.id as vendedor_id,
    v.nome as vendedor_nome,
    v.email,
    v.telefone,

    -- ==== CLIENTES ====
    COALESCE(cli_stats.total_clientes, 0) as total_clientes,
    COALESCE(cli_stats.clientes_mes, 0) as clientes_mes,
    COALESCE(cli_stats.clientes_semana, 0) as clientes_semana,
    COALESCE(cli_stats.clientes_com_lembrete, 0) as clientes_com_lembrete,
    COALESCE(cli_stats.lembretes_atrasados, 0) as lembretes_atrasados,
    COALESCE(cli_stats.lembretes_hoje, 0) as lembretes_hoje,
    COALESCE(cli_stats.lembretes_semana, 0) as lembretes_semana,
    cli_stats.ultimo_cliente,

    -- ==== VISITAS ====
    COALESCE(vis_stats.total_visitas, 0) as total_visitas,
    COALESCE(vis_stats.visitas_hoje, 0) as visitas_hoje,
    COALESCE(vis_stats.visitas_semana, 0) as visitas_semana,
    COALESCE(vis_stats.visitas_mes, 0) as visitas_mes,
    COALESCE(vis_stats.visitas_prospeccao, 0) as visitas_prospeccao,
    COALESCE(vis_stats.visitas_analise, 0) as visitas_analise,
    COALESCE(vis_stats.visitas_suporte, 0) as visitas_suporte,
    COALESCE(vis_stats.visitas_posvenda, 0) as visitas_posvenda,
    vis_stats.ultima_visita,

    -- ==== VENDAS ====
    COALESCE(vis_stats.vendas_negociacao, 0) as vendas_negociacao,
    COALESCE(vis_stats.vendas_fechadas, 0) as vendas_fechadas,
    COALESCE(vis_stats.vendas_perdidas, 0) as vendas_perdidas,
    COALESCE(vis_stats.valor_negociacao, 0) as valor_negociacao,
    COALESCE(vis_stats.valor_fechado, 0) as valor_fechado,

    -- ==== PLANTIOS ====
    COALESCE(plant_stats.total_plantios, 0) as total_plantios,
    COALESCE(plant_stats.plantios_ativos, 0) as plantios_ativos,
    COALESCE(plant_stats.plantios_milho, 0) as plantios_milho,
    COALESCE(plant_stats.plantios_soja, 0) as plantios_soja,
    COALESCE(plant_stats.plantios_graos, 0) as plantios_graos,

    -- ==== CONTATOS ====
    COALESCE(cont_stats.total_contatos, 0) as total_contatos,
    COALESCE(cont_stats.contatos_sucesso, 0) as contatos_sucesso,
    COALESCE(cont_stats.contatos_sem_resposta, 0) as contatos_sem_resposta

FROM vendedores v

-- Subquery: Estatísticas de Clientes
LEFT JOIN (
    SELECT
        vendedor_id,
        COUNT(*) as total_clientes,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') as clientes_mes,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as clientes_semana,
        COUNT(*) FILTER (WHERE lembrete_data IS NOT NULL) as clientes_com_lembrete,
        COUNT(*) FILTER (WHERE lembrete_data < CURRENT_DATE) as lembretes_atrasados,
        COUNT(*) FILTER (WHERE lembrete_data = CURRENT_DATE) as lembretes_hoje,
        COUNT(*) FILTER (WHERE lembrete_data BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7) as lembretes_semana,
        MAX(created_at) as ultimo_cliente
    FROM clientes
    WHERE ativo = true
    GROUP BY vendedor_id
) cli_stats ON cli_stats.vendedor_id = v.id

-- Subquery: Estatísticas de Visitas e Vendas
LEFT JOIN (
    SELECT
        vendedor_id,
        COUNT(*) as total_visitas,
        COUNT(*) FILTER (WHERE DATE(data_hora) = CURRENT_DATE) as visitas_hoje,
        COUNT(*) FILTER (WHERE data_hora >= CURRENT_DATE - INTERVAL '7 days') as visitas_semana,
        COUNT(*) FILTER (WHERE data_hora >= CURRENT_DATE - INTERVAL '30 days') as visitas_mes,
        COUNT(*) FILTER (WHERE motivo = 'prospeccao') as visitas_prospeccao,
        COUNT(*) FILTER (WHERE motivo = 'analise') as visitas_analise,
        COUNT(*) FILTER (WHERE motivo = 'suporte') as visitas_suporte,
        COUNT(*) FILTER (WHERE motivo = 'posvenda') as visitas_posvenda,
        COUNT(*) FILTER (WHERE status_venda = 'negociacao') as vendas_negociacao,
        COUNT(*) FILTER (WHERE status_venda = 'fechado') as vendas_fechadas,
        COUNT(*) FILTER (WHERE status_venda = 'perdido') as vendas_perdidas,
        SUM(valor_estimado) FILTER (WHERE status_venda = 'negociacao') as valor_negociacao,
        SUM(valor_estimado) FILTER (WHERE status_venda = 'fechado') as valor_fechado,
        MAX(data_hora) as ultima_visita
    FROM visitas
    GROUP BY vendedor_id
) vis_stats ON vis_stats.vendedor_id = v.id

-- Subquery: Estatísticas de Plantios (via clientes)
LEFT JOIN (
    SELECT
        c.vendedor_id,
        COUNT(p.id) as total_plantios,
        COUNT(p.id) FILTER (WHERE p.ativo = true) as plantios_ativos,
        COUNT(p.id) FILTER (WHERE p.cultura = 'Milho' AND p.ativo = true) as plantios_milho,
        COUNT(p.id) FILTER (WHERE p.cultura = 'Soja' AND p.ativo = true) as plantios_soja,
        COUNT(p.id) FILTER (WHERE p.cultura = 'Grãos' AND p.ativo = true) as plantios_graos
    FROM plantios p
    INNER JOIN clientes c ON p.cliente_id = c.id
    WHERE c.ativo = true
    GROUP BY c.vendedor_id
) plant_stats ON plant_stats.vendedor_id = v.id

-- Subquery: Estatísticas de Contatos
LEFT JOIN (
    SELECT
        vendedor_id,
        COUNT(*) as total_contatos,
        COUNT(*) FILTER (WHERE resultado = 'sucesso') as contatos_sucesso,
        COUNT(*) FILTER (WHERE resultado = 'sem-resposta') as contatos_sem_resposta
    FROM contatos
    GROUP BY vendedor_id
) cont_stats ON cont_stats.vendedor_id = v.id

WHERE v.ativo = true
ORDER BY COALESCE(vis_stats.total_visitas, 0) DESC, COALESCE(cli_stats.total_clientes, 0) DESC;

-- =====================================================
-- VIEW: plantios_criticos (CENTRALIZADA)
-- =====================================================
-- Calcula estágios fenológicos CENTRALIZADAMENTE
-- Frontend apenas exibe, não recalcula
-- =====================================================

CREATE OR REPLACE VIEW plantios_criticos AS
SELECT
    p.id as plantio_id,
    p.cliente_id,
    c.nome as cliente_nome,
    c.propriedade_nome,
    c.cidade,
    c.vendedor_id,
    v.nome as vendedor_nome,
    p.cultura,
    p.tipo,
    p.data_plantio,
    (CURRENT_DATE - p.data_plantio)::INTEGER as dias_plantio,

    -- Cálculo de estágio (ÚNICA FONTE DE VERDADE)
    CASE
        WHEN p.cultura IN ('Soja', 'Milho', 'Grãos') THEN
            CASE
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER <= 5 THEN 'V2 (Germinação)'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER <= 14 THEN 'V3-V4 (Inicial)'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER <= 28 THEN 'V6-V8 (Vegetativo)'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER <= 42 THEN 'V9-V10 (Pré-pendão)'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER BETWEEN 43 AND 65 THEN 'VT (Pendão) - CRÍTICO'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER BETWEEN 66 AND 150 THEN 'R1-R6 (Reprodutivo)'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER > 150 THEN 'Colhido'
                ELSE 'Pré-plantio'
            END
        WHEN p.cultura = 'Silagem' THEN
            CASE
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER <= 5 THEN 'V2 (Germinação)'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER <= 45 THEN 'Vegetativo'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER BETWEEN 46 AND 65 THEN 'VT (Ponto de Corte?) - CRÍTICO'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER BETWEEN 66 AND 120 THEN 'Maturação'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER > 120 THEN 'Colhido'
                ELSE 'N/A'
            END
        ELSE 'N/A'
    END as estagio,

    -- Flag de crítico (oportunidade de negociação)
    CASE
        WHEN p.cultura IN ('Soja', 'Milho', 'Grãos') AND
             (CURRENT_DATE - p.data_plantio)::INTEGER BETWEEN 43 AND 65 THEN true
        WHEN p.cultura = 'Silagem' AND
             (CURRENT_DATE - p.data_plantio)::INTEGER BETWEEN 46 AND 65 THEN true
        ELSE false
    END as critico,

    -- Mensagem de ação
    CASE
        WHEN p.cultura IN ('Soja', 'Milho', 'Grãos') AND
             (CURRENT_DATE - p.data_plantio)::INTEGER BETWEEN 43 AND 65 THEN 'NEGOCIAÇÃO URGENTE!'
        WHEN p.cultura IN ('Soja', 'Milho', 'Grãos') AND
             (CURRENT_DATE - p.data_plantio)::INTEGER BETWEEN 66 AND 150 THEN 'Acompanhar reprodutivo'
        WHEN (CURRENT_DATE - p.data_plantio)::INTEGER > 150 THEN 'Retornar pós-safra'
        ELSE 'Monitorar desenvolvimento'
    END as acao_recomendada

FROM plantios p
LEFT JOIN clientes c ON p.cliente_id = c.id
LEFT JOIN vendedores v ON c.vendedor_id = v.id
WHERE p.ativo = true
  AND c.ativo = true
  AND p.data_plantio <= CURRENT_DATE
ORDER BY critico DESC, dias_plantio DESC;

-- =====================================================
-- PERMISSÕES DE ACESSO ÀS VIEWS
-- =====================================================

GRANT SELECT ON relatorio_vendedores TO anon, authenticated;
GRANT SELECT ON plantios_criticos TO anon, authenticated;

-- =====================================================
-- ÍNDICES EXISTENTES UTILIZADOS
-- =====================================================
-- ✅ idx_clientes_vendedor (clientes.vendedor_id)
-- ✅ idx_visitas_vendedor (visitas.vendedor_id)
-- ✅ idx_plantios_cliente (plantios.cliente_id)
-- ✅ idx_contatos_vendedor (contatos.vendedor_id)
-- ✅ idx_plantios_ativo (plantios.ativo)
-- ✅ idx_plantios_data (plantios.data_plantio)
-- =====================================================

-- =====================================================
-- VALIDAÇÃO FINAL
-- =====================================================

SELECT
    'Views criadas com sucesso!' as status,
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'relatorio_vendedores') as view_relatorio_ok,
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'plantios_criticos') as view_plantios_ok;

-- =====================================================
-- TESTES RECOMENDADOS
-- =====================================================

-- Teste 1: Verificar contagens corretas
-- SELECT * FROM relatorio_vendedores LIMIT 5;

-- Teste 2: Verificar plantios críticos
-- SELECT * FROM plantios_criticos WHERE critico = true;

-- Teste 3: Verificar totais gerais
-- SELECT
--     SUM(total_visitas) as total_visitas_sistema,
--     SUM(total_clientes) as total_clientes_sistema,
--     SUM(plantios_ativos) as total_plantios_sistema
-- FROM relatorio_vendedores;
