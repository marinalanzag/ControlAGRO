# 📊 Plano Técnico: Relatório Gerencial de Vendedores

## 🎯 Objetivo

Criar funcionalidade exclusiva para gestores visualizarem **métricas detalhadas de desempenho** da equipe de vendas de forma consolidada e intuitiva.

---

## 📋 ANÁLISE DA ESTRUTURA ATUAL

### ✅ Dados Disponíveis

#### Tabelas Existentes:

| Tabela | Campos Principais | Relação |
|--------|-------------------|---------|
| `vendedores` | id, nome, email, telefone | - |
| `clientes` | id, vendedor_id, nome, propriedade, origem | FK → vendedores |
| `visitas` | id, vendedor_id, cliente_id, data_hora, motivo, status_venda, valor_estimado | FK → vendedores, clientes |
| `plantios` | id, cliente_id, cultura, tipo, data_plantio, ativo | FK → clientes |
| `contatos` | id, vendedor_id, cliente_id, resultado, data_hora | FK → vendedores, clientes |

#### Sistema de Permissões Existente:

- ✅ **`isMaster`** (boolean) - Indica se usuário é gestor
- ✅ **`masterName`** (string) - Nome do gestor (IVO, GLADSTON)
- ✅ Função `getMyVisitas()` e `getMyClientes()` - Filtra por vendedor ou retorna tudo se isMaster

#### Interface Existente:

- ✅ 4 abas principais: Dashboard, Visitas, Clientes, Equipe
- ✅ Badge "GESTOR" aparece para masters
- ✅ Botão "Marcar visto" exclusivo para masters

---

## 🏗️ ARQUITETURA DA SOLUÇÃO

### 1️⃣ **Camada de Dados (Database)**

#### View SQL: `relatorio_vendedores`

Consolidar métricas de cada vendedor em uma view otimizada:

```sql
CREATE OR REPLACE VIEW relatorio_vendedores AS
SELECT
    v.id as vendedor_id,
    v.nome as vendedor_nome,
    v.email,
    v.telefone,

    -- Clientes
    COUNT(DISTINCT c.id) as total_clientes,
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= CURRENT_DATE - INTERVAL '30 days') as clientes_mes,
    COUNT(DISTINCT c.id) FILTER (WHERE c.created_at >= CURRENT_DATE - INTERVAL '7 days') as clientes_semana,

    -- Visitas
    COUNT(DISTINCT vis.id) as total_visitas,
    COUNT(DISTINCT vis.id) FILTER (WHERE vis.data_hora >= CURRENT_DATE - INTERVAL '30 days') as visitas_mes,
    COUNT(DISTINCT vis.id) FILTER (WHERE vis.data_hora >= CURRENT_DATE - INTERVAL '7 days') as visitas_semana,
    COUNT(DISTINCT vis.id) FILTER (WHERE DATE(vis.data_hora) = CURRENT_DATE) as visitas_hoje,

    -- Visitas por motivo
    COUNT(DISTINCT vis.id) FILTER (WHERE vis.motivo = 'prospeccao') as visitas_prospeccao,
    COUNT(DISTINCT vis.id) FILTER (WHERE vis.motivo = 'analise') as visitas_analise,
    COUNT(DISTINCT vis.id) FILTER (WHERE vis.motivo = 'suporte') as visitas_suporte,
    COUNT(DISTINCT vis.id) FILTER (WHERE vis.motivo = 'posvenda') as visitas_posvenda,

    -- Status de vendas
    COUNT(DISTINCT vis.id) FILTER (WHERE vis.status_venda = 'negociacao') as vendas_negociacao,
    COUNT(DISTINCT vis.id) FILTER (WHERE vis.status_venda = 'fechado') as vendas_fechadas,
    COUNT(DISTINCT vis.id) FILTER (WHERE vis.status_venda = 'perdido') as vendas_perdidas,
    COALESCE(SUM(vis.valor_estimado) FILTER (WHERE vis.status_venda = 'negociacao'), 0) as valor_negociacao,
    COALESCE(SUM(vis.valor_estimado) FILTER (WHERE vis.status_venda = 'fechado'), 0) as valor_fechado,

    -- Plantios
    COUNT(DISTINCT p.id) as total_plantios,
    COUNT(DISTINCT p.id) FILTER (WHERE p.ativo = true) as plantios_ativos,

    -- Plantios por cultura
    COUNT(DISTINCT p.id) FILTER (WHERE p.cultura = 'Milho' AND p.ativo = true) as plantios_milho,
    COUNT(DISTINCT p.id) FILTER (WHERE p.cultura = 'Soja' AND p.ativo = true) as plantios_soja,
    COUNT(DISTINCT p.id) FILTER (WHERE p.cultura = 'Grãos' AND p.ativo = true) as plantios_graos,

    -- Lembretes e retornos
    COUNT(DISTINCT c.id) FILTER (WHERE c.lembrete_data IS NOT NULL) as clientes_com_lembrete,
    COUNT(DISTINCT c.id) FILTER (WHERE c.lembrete_data < CURRENT_DATE) as lembretes_atrasados,
    COUNT(DISTINCT c.id) FILTER (WHERE c.lembrete_data = CURRENT_DATE) as lembretes_hoje,
    COUNT(DISTINCT c.id) FILTER (WHERE c.lembrete_data BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 7) as lembretes_semana,

    -- Contatos
    COUNT(DISTINCT cont.id) as total_contatos,
    COUNT(DISTINCT cont.id) FILTER (WHERE cont.resultado = 'sucesso') as contatos_sucesso,
    COUNT(DISTINCT cont.id) FILTER (WHERE cont.resultado = 'sem-resposta') as contatos_sem_resposta,

    -- Última atividade
    MAX(vis.data_hora) as ultima_visita,
    MAX(c.created_at) as ultimo_cliente

FROM vendedores v
LEFT JOIN clientes c ON c.vendedor_id = v.id AND c.ativo = true
LEFT JOIN visitas vis ON vis.vendedor_id = v.id
LEFT JOIN plantios p ON p.cliente_id = c.id
LEFT JOIN contatos cont ON cont.vendedor_id = v.id
WHERE v.ativo = true
GROUP BY v.id, v.nome, v.email, v.telefone
ORDER BY total_visitas DESC, total_clientes DESC;
```

#### View SQL: `plantios_criticos`

Identificar plantios em estágios estratégicos para negociação:

```sql
CREATE OR REPLACE VIEW plantios_criticos AS
SELECT
    p.id as plantio_id,
    p.cliente_id,
    c.nome as cliente_nome,
    c.vendedor_id,
    v.nome as vendedor_nome,
    p.cultura,
    p.tipo,
    p.data_plantio,
    (CURRENT_DATE - p.data_plantio)::INTEGER as dias_plantio,
    CASE
        WHEN p.cultura IN ('Soja', 'Milho', 'Grãos') THEN
            CASE
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER BETWEEN 43 AND 65 THEN 'VT (Pendão) - CRÍTICO'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER BETWEEN 66 AND 150 THEN 'R1-R6 (Reprodutivo)'
                WHEN (CURRENT_DATE - p.data_plantio)::INTEGER > 150 THEN 'Colhido'
                ELSE 'Vegetativo'
            END
        ELSE 'N/A'
    END as estagio,
    CASE
        WHEN p.cultura IN ('Soja', 'Milho', 'Grãos') AND (CURRENT_DATE - p.data_plantio)::INTEGER BETWEEN 43 AND 65 THEN true
        ELSE false
    END as critico
FROM plantios p
LEFT JOIN clientes c ON p.cliente_id = c.id
LEFT JOIN vendedores v ON c.vendedor_id = v.id
WHERE p.ativo = true
  AND c.ativo = true
ORDER BY critico DESC, dias_plantio DESC;
```

---

### 2️⃣ **Camada de Backend (Data Loading)**

#### Adicionar ao `data-loader.js`:

```javascript
async loadRelatorioVendedores() {
    if (isOnline()) {
        const { data, error } = await db
            .from("relatorio_vendedores")
            .select("*");

        if (!error && data) {
            await offlineDB.clear("relatorio_vendedores");
            for (const item of data) {
                await offlineDB.put("relatorio_vendedores", item);
            }
            return data;
        }
    }

    return await offlineDB.getAll("relatorio_vendedores");
},

async loadPlantiosCriticos() {
    if (isOnline()) {
        const { data, error } = await db
            .from("plantios_criticos")
            .select("*");

        if (!error && data) {
            await offlineDB.clear("plantios_criticos");
            for (const item of data) {
                await offlineDB.put("plantios_criticos", item);
            }
            return data;
        }
    }

    return await offlineDB.getAll("plantios_criticos");
}
```

---

### 3️⃣ **Camada de Frontend (Interface)**

#### A. Adicionar Nova Aba "Relatórios" (apenas para gestores)

**Localização:** `src/index.html` - Seção `<nav>`

```html
<!-- Aba Relatórios - VISÍVEL APENAS PARA GESTORES -->
<button class="nav-t" data-tab="relatorios" id="navRelatorios" style="display:none">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3v18h18" />
        <path d="M18 17V9" />
        <path d="M13 17V5" />
        <path d="M8 17v-3" />
    </svg>
    Relatórios
</button>
```

#### B. Criar Seção de Relatórios

**Localização:** `src/index.html` - Dentro de `<main class="main">`

```html
<!-- SEÇÃO: RELATÓRIOS (GESTOR) -->
<section class="scr" id="scr-relatorios">
    <div class="sec-h">
        <h2 class="sec-t">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 3v18h18" />
                <path d="M18 17V9" />
                <path d="M13 17V5" />
                <path d="M8 17v-3" />
            </svg>
            Relatório de Vendedores
        </h2>
    </div>

    <!-- Filtros -->
    <div class="filters-bar">
        <select id="filtroPeriodo" class="f-inp" onchange="aplicarFiltros()">
            <option value="hoje">Hoje</option>
            <option value="semana">Últimos 7 dias</option>
            <option value="mes" selected>Últimos 30 dias</option>
            <option value="total">Total</option>
        </select>
        <button onclick="exportarRelatorio()" class="btn-sec">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Exportar
        </button>
    </div>

    <!-- Resumo Geral -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value" id="statTotalVendedores">0</div>
            <div class="stat-label">Vendedores Ativos</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" id="statTotalVisitas">0</div>
            <div class="stat-label">Visitas Realizadas</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" id="statTotalClientes">0</div>
            <div class="stat-label">Clientes Cadastrados</div>
        </div>
        <div class="stat-card">
            <div class="stat-value" id="statOportunidades">0</div>
            <div class="stat-label">Oportunidades Críticas</div>
        </div>
    </div>

    <!-- Lista de Vendedores -->
    <div id="relatorioVendedoresList" class="relatorio-list">
        <div class="load"><div class="spinner"></div></div>
    </div>
</section>
```

---

### 4️⃣ **Camada de Lógica (app.js)**

#### A. Variáveis Globais

```javascript
let relatorioVendedores = [];
let plantiosCriticos = [];
let filtroAtivo = 'mes';
```

#### B. Carregar Dados do Relatório

```javascript
async function loadRelatorioVendedores() {
    relatorioVendedores = await dataLoaders.loadRelatorioVendedores();
    plantiosCriticos = await dataLoaders.loadPlantiosCriticos();
    console.log('Relatório carregado:', relatorioVendedores.length, 'vendedores');
}
```

#### C. Renderizar Relatório

```javascript
function renderRelatorioVendedores() {
    if (!isMaster) {
        document.getElementById('relatorioVendedoresList').innerHTML =
            '<div class="empty"><p>Acesso restrito a gestores</p></div>';
        return;
    }

    const periodo = filtroAtivo;
    const container = document.getElementById('relatorioVendedoresList');

    // Calcular totais
    const totais = calcularTotais(relatorioVendedores, periodo);
    document.getElementById('statTotalVendedores').textContent = relatorioVendedores.length;
    document.getElementById('statTotalVisitas').textContent = totais.visitas;
    document.getElementById('statTotalClientes').textContent = totais.clientes;
    document.getElementById('statOportunidades').textContent = plantiosCriticos.filter(p => p.critico).length;

    // Renderizar lista de vendedores
    container.innerHTML = relatorioVendedores
        .map(v => renderVendedorCard(v, periodo))
        .join('') || '<div class="empty"><p>Nenhum vendedor encontrado</p></div>';
}

function calcularTotais(vendedores, periodo) {
    const campo = periodo === 'hoje' ? 'visitas_hoje'
                : periodo === 'semana' ? 'visitas_semana'
                : periodo === 'mes' ? 'visitas_mes'
                : 'total_visitas';

    const campoClientes = periodo === 'semana' ? 'clientes_semana'
                        : periodo === 'mes' ? 'clientes_mes'
                        : 'total_clientes';

    return {
        visitas: vendedores.reduce((sum, v) => sum + (v[campo] || 0), 0),
        clientes: vendedores.reduce((sum, v) => sum + (v[campoClientes] || 0), 0)
    };
}

function renderVendedorCard(vendedor, periodo) {
    const visitas = periodo === 'hoje' ? vendedor.visitas_hoje
                  : periodo === 'semana' ? vendedor.visitas_semana
                  : periodo === 'mes' ? vendedor.visitas_mes
                  : vendedor.total_visitas;

    const clientes = periodo === 'semana' ? vendedor.clientes_semana
                   : periodo === 'mes' ? vendedor.clientes_mes
                   : vendedor.total_clientes;

    const oportunidades = plantiosCriticos.filter(p =>
        p.vendedor_id === vendedor.vendedor_id && p.critico
    ).length;

    const taxaConversao = vendedor.vendas_fechadas + vendedor.vendas_perdidas > 0
        ? Math.round((vendedor.vendas_fechadas / (vendedor.vendas_fechadas + vendedor.vendas_perdidas)) * 100)
        : 0;

    return `
        <div class="vendedor-card" onclick="abrirDetalhesVendedor('${vendedor.vendedor_id}')">
            <div class="vendedor-header">
                <div class="vendedor-avatar">${initials(vendedor.vendedor_nome)}</div>
                <div class="vendedor-info">
                    <h3>${vendedor.vendedor_nome}</h3>
                    <p>${vendedor.email}</p>
                </div>
                <div class="vendedor-badge ${oportunidades > 0 ? 'badge-critical' : 'badge-ok'}">
                    ${oportunidades} oportunidades
                </div>
            </div>

            <div class="vendedor-stats">
                <div class="stat-item">
                    <div class="stat-value">${visitas}</div>
                    <div class="stat-label">Visitas</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${clientes}</div>
                    <div class="stat-label">Clientes</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${vendedor.plantios_ativos}</div>
                    <div class="stat-label">Plantios</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${taxaConversao}%</div>
                    <div class="stat-label">Conversão</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${fmtCurS(vendedor.valor_negociacao)}</div>
                    <div class="stat-label">Negociação</div>
                </div>
            </div>

            <div class="vendedor-lembretes">
                ${vendedor.lembretes_atrasados > 0 ? `<span class="badge-alert">${vendedor.lembretes_atrasados} atrasados</span>` : ''}
                ${vendedor.lembretes_hoje > 0 ? `<span class="badge-today">${vendedor.lembretes_hoje} hoje</span>` : ''}
            </div>
        </div>
    `;
}
```

#### D. Modal de Detalhes do Vendedor

```javascript
function abrirDetalhesVendedor(vendedorId) {
    const vendedor = relatorioVendedores.find(v => v.vendedor_id === vendedorId);
    if (!vendedor) return;

    const clientesVendedor = clientes.filter(c => c.vendedor_id === vendedorId);
    const visitasVendedor = visitas.filter(v => v.vendedor_id === vendedorId);
    const plantiosVendedor = plantiosCriticos.filter(p => p.vendedor_id === vendedorId);

    const modalHtml = `
        <div class="modal-overlay" onclick="fecharDetalhesVendedor()">
            <div class="modal-content large" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h2>Detalhes - ${vendedor.vendedor_nome}</h2>
                    <button onclick="fecharDetalhesVendedor()" class="btn-close">×</button>
                </div>

                <div class="tabs-container">
                    <div class="tabs">
                        <button class="tab active" data-tab="resumo">Resumo</button>
                        <button class="tab" data-tab="clientes">Clientes (${clientesVendedor.length})</button>
                        <button class="tab" data-tab="visitas">Visitas (${visitasVendedor.length})</button>
                        <button class="tab" data-tab="plantios">Plantios (${plantiosVendedor.length})</button>
                    </div>

                    <div class="tab-content active" data-tab="resumo">
                        ${renderResumoVendedor(vendedor)}
                    </div>

                    <div class="tab-content" data-tab="clientes">
                        ${clientesVendedor.map(c => renderCliCard(c)).join('')}
                    </div>

                    <div class="tab-content" data-tab="visitas">
                        ${visitasVendedor.map(v => renderVisCard(v, true)).join('')}
                    </div>

                    <div class="tab-content" data-tab="plantios">
                        ${renderPlantiosVendedor(plantiosVendedor)}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function fecharDetalhesVendedor() {
    document.querySelector('.modal-overlay').remove();
}
```

#### E. Aplicar Filtros

```javascript
function aplicarFiltros() {
    filtroAtivo = document.getElementById('filtroPeriodo').value;
    renderRelatorioVendedores();
}
```

#### F. Exportar Relatório

```javascript
function exportarRelatorio() {
    const periodo = filtroAtivo;
    const data = relatorioVendedores.map(v => ({
        Vendedor: v.vendedor_nome,
        Email: v.email,
        Clientes: periodo === 'mes' ? v.clientes_mes : v.total_clientes,
        Visitas: periodo === 'mes' ? v.visitas_mes : v.total_visitas,
        Plantios: v.plantios_ativos,
        'Valor Negociação': v.valor_negociacao,
        'Vendas Fechadas': v.vendas_fechadas,
        'Taxa Conversão': `${((v.vendas_fechadas / (v.vendas_fechadas + v.vendas_perdidas || 1)) * 100).toFixed(1)}%`
    }));

    // Converter para CSV
    const csv = [
        Object.keys(data[0]).join(','),
        ...data.map(row => Object.values(row).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-vendedores-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}
```

#### G. Mostrar/Ocultar Aba Relatórios

```javascript
function toggleRelatoriosTab() {
    const navRelatorios = document.getElementById('navRelatorios');
    if (navRelatorios) {
        navRelatorios.style.display = isMaster ? '' : 'none';
    }
}

// Chamar ao fazer login
function selectUser(id, master, name, restore = false) {
    // ... código existente ...
    isMaster = master;

    toggleRelatoriosTab();  // ADICIONAR

    // ... resto do código ...
}
```

---

### 5️⃣ **Camada de Estilo (CSS)**

#### Adicionar em `src/styles/app.css`:

```css
/* =============================================== */
/* RELATÓRIOS */
/* =============================================== */

.relatorio-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-top: 1rem;
}

.vendedor-card {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 1.5rem;
    cursor: pointer;
    transition: all 0.3s ease;
    border: 1px solid var(--border);
}

.vendedor-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    border-color: var(--g6);
}

.vendedor-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
}

.vendedor-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--g6);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 1.1rem;
}

.vendedor-info {
    flex: 1;
}

.vendedor-info h3 {
    margin: 0;
    font-size: 1.1rem;
    color: var(--text);
}

.vendedor-info p {
    margin: 0.25rem 0 0;
    font-size: 0.875rem;
    color: var(--text-muted);
}

.vendedor-badge {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 600;
}

.badge-critical {
    background: #fee;
    color: #c00;
}

.badge-ok {
    background: #efe;
    color: #080;
}

.vendedor-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: 1rem;
    padding: 1rem 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
}

.stat-item {
    text-align: center;
}

.stat-item .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--g6);
}

.stat-item .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 0.25rem;
}

.vendedor-lembretes {
    display: flex;
    gap: 0.5rem;
    margin-top: 1rem;
}

.badge-alert {
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    background: #fee;
    color: #c00;
    font-weight: 600;
}

.badge-today {
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    font-size: 0.75rem;
    background: #eef;
    color: #00c;
    font-weight: 600;
}

.filters-bar {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin: 1rem 0;
}

.stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin: 1rem 0;
}

.stat-card {
    background: var(--card-bg);
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
    border: 1px solid var(--border);
}

.stat-card .stat-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--g6);
}

.stat-card .stat-label {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin-top: 0.5rem;
}

/* Modal Grande */
.modal-content.large {
    max-width: 90vw;
    max-height: 90vh;
    overflow-y: auto;
}

.tabs-container {
    margin-top: 1rem;
}

.tabs {
    display: flex;
    gap: 0.5rem;
    border-bottom: 2px solid var(--border);
}

.tab {
    padding: 0.75rem 1.5rem;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-weight: 600;
    color: var(--text-muted);
    transition: all 0.3s ease;
}

.tab.active {
    color: var(--g6);
    border-bottom-color: var(--g6);
}

.tab-content {
    display: none;
    padding: 1rem 0;
}

.tab-content.active {
    display: block;
}
```

---

## 📊 ESTRUTURA DE DADOS

### Métricas Calculadas por Vendedor:

| Categoria | Métricas |
|-----------|----------|
| **Clientes** | Total, Mês, Semana |
| **Visitas** | Total, Hoje, Semana, Mês, Por Motivo |
| **Vendas** | Negociação, Fechadas, Perdidas, Taxa Conversão, Valor Total |
| **Plantios** | Total, Ativos, Por Cultura, Críticos |
| **Lembretes** | Total, Atrasados, Hoje, Próxima Semana |
| **Contatos** | Total, Sucesso, Sem Resposta |
| **Atividade** | Última Visita, Último Cliente |

---

## 🔐 CONTROLE DE ACESSO

### Regra de Negócio:

```javascript
if (!isMaster) {
    // Ocultar aba Relatórios
    // Bloquear acesso à view relatorio_vendedores
    // Retornar mensagem "Acesso restrito"
}
```

### Implementação:

1. **Frontend:** Aba "Relatórios" só aparece se `isMaster === true`
2. **Renderização:** Função `renderRelatorioVendedores()` valida `isMaster` antes de exibir dados
3. **Database:** Políticas RLS podem ser configuradas (opcional)

---

## 📱 RESPONSIVIDADE

### Mobile-First:

- Grid adaptativo (1 coluna em mobile, múltiplas em desktop)
- Cards empilhados verticalmente
- Tabs horizontalmente scrolláveis
- Modal ocupa 90% da tela em mobile

---

## 🚀 PLANO DE IMPLEMENTAÇÃO

### **FASE 1: Backend (Banco de Dados)** - 30min

✅ **Tarefas:**
1. Criar view `relatorio_vendedores`
2. Criar view `plantios_criticos`
3. Adicionar grants de permissão
4. Testar queries no SQL Editor

📄 **Arquivo:** `database-relatorio-vendedores.sql`

---

### **FASE 2: Data Loading** - 15min

✅ **Tarefas:**
1. Adicionar `loadRelatorioVendedores()` em `data-loader.js`
2. Adicionar `loadPlantiosCriticos()` em `data-loader.js`
3. Criar stores no IndexedDB para cache offline

📄 **Arquivo:** `src/scripts/data-loader.js`

---

### **FASE 3: Frontend - Estrutura HTML** - 20min

✅ **Tarefas:**
1. Adicionar botão "Relatórios" na navegação
2. Criar seção `<section id="scr-relatorios">`
3. Adicionar filtros de período
4. Criar containers de estatísticas

📄 **Arquivo:** `src/index.html`

---

### **FASE 4: Frontend - Lógica JavaScript** - 45min

✅ **Tarefas:**
1. Adicionar variáveis globais (`relatorioVendedores`, `plantiosCriticos`)
2. Implementar `renderRelatorioVendedores()`
3. Implementar `renderVendedorCard()`
4. Implementar `abrirDetalhesVendedor()`
5. Implementar `aplicarFiltros()`
6. Implementar `exportarRelatorio()`
7. Implementar controle de exibição de aba

📄 **Arquivo:** `src/scripts/app.js`

---

### **FASE 5: Estilização CSS** - 30min

✅ **Tarefas:**
1. Estilizar cards de vendedores
2. Estilizar modal de detalhes
3. Estilizar tabs
4. Garantir responsividade
5. Adicionar animações e transições

📄 **Arquivo:** `src/styles/app.css`

---

### **FASE 6: Integração e Testes** - 20min

✅ **Tarefas:**
1. Integrar carregamento de dados na inicialização
2. Testar filtros de período
3. Testar modal de detalhes
4. Testar exportação CSV
5. Testar acesso restrito (vendedor vs gestor)
6. Testar responsividade

---

### **FASE 7: Documentação** - 10min

✅ **Tarefas:**
1. Atualizar README com nova funcionalidade
2. Documentar métricas calculadas
3. Criar guia de uso para gestores

📄 **Arquivo:** `RELATORIO-VENDEDORES.md`

---

## ⏱️ TEMPO TOTAL ESTIMADO

| Fase | Tempo |
|------|-------|
| Fase 1 - Backend | 30min |
| Fase 2 - Data Loading | 15min |
| Fase 3 - HTML | 20min |
| Fase 4 - JavaScript | 45min |
| Fase 5 - CSS | 30min |
| Fase 6 - Testes | 20min |
| Fase 7 - Documentação | 10min |
| **TOTAL** | **2h 50min** |

---

## 📋 CHECKLIST PRÉ-IMPLEMENTAÇÃO

Antes de começar a implementar, confirme:

- [ ] Todas as tabelas necessárias existem (vendedores, clientes, visitas, plantios, contatos)
- [ ] Sistema de permissões `isMaster` está funcionando
- [ ] Views existentes servem de referência (ex: `vendedores_performance`)
- [ ] IndexedDB suporta novas stores
- [ ] Estrutura de navegação suporta nova aba

---

## 🎯 ENTREGÁVEIS FINAIS

### 1. **Arquivos Criados:**
- `database-relatorio-vendedores.sql` - Views e queries
- `RELATORIO-VENDEDORES.md` - Documentação de uso

### 2. **Arquivos Modificados:**
- `src/scripts/data-loader.js` - Novas funções de carga
- `src/scripts/app.js` - Lógica de relatórios
- `src/index.html` - Nova aba e seção
- `src/styles/app.css` - Estilos dos componentes

### 3. **Funcionalidades Implementadas:**
- ✅ Aba "Relatórios" exclusiva para gestores
- ✅ Lista consolidada de vendedores com métricas
- ✅ Filtros por período (Hoje, Semana, Mês, Total)
- ✅ Modal de detalhes com 4 abas (Resumo, Clientes, Visitas, Plantios)
- ✅ Exportação CSV
- ✅ Identificação de oportunidades críticas (plantios em VT)
- ✅ Controle de acesso por perfil

---

## 🚨 CONSIDERAÇÕES IMPORTANTES

### Performance:
- Views pré-calculadas evitam queries pesadas em tempo real
- IndexedDB garante funcionamento offline
- Paginação pode ser necessária se >50 vendedores

### Segurança:
- Validação `isMaster` no frontend (primeira barreira)
- RLS no Supabase pode adicionar camada extra (opcional)
- Logs de acesso podem ser implementados

### Escalabilidade:
- Views suportam milhares de registros
- Frontend renderiza apenas dados filtrados
- Cache offline reduz chamadas ao servidor

---

## ✅ APROVAÇÃO PARA IMPLEMENTAÇÃO

Este plano está **pronto para ser executado** fase por fase.

**Próximo passo:** Confirmar aprovação e iniciar **FASE 1 - Backend**.

Deseja que eu comece a implementação agora?
