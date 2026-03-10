# 📊 Relatório Gerencial de Vendedores - Guia do Usuário

## 🎯 Visão Geral

O **Relatório Gerencial de Vendedores** é uma funcionalidade exclusiva para **gestores** (usuários com perfil Master) que permite acompanhar o desempenho de toda a equipe de vendas em um único painel consolidado.

## ✨ Recursos Principais

### 1. **Acesso Exclusivo para Gestores**
- Apenas usuários logados como "GESTOR" podem acessar este relatório
- A aba "Relatórios" aparece automaticamente na navegação para gestores
- Vendedores não têm acesso a esta funcionalidade

### 2. **Métricas Consolidadas por Vendedor**
Cada vendedor exibe um card com as seguintes métricas principais:
- 📍 **Visitas**: Total de visitas técnicas realizadas
- 👥 **Clientes**: Quantidade de clientes cadastrados
- 💰 **Vendas**: Número de vendas fechadas
- 💵 **Valor**: Valor total vendido (em R$)

### 3. **Filtros por Período**
Visualize os dados filtrados por:
- **Total**: Todas as métricas desde o início
- **Mês**: Dados dos últimos 30 dias
- **Semana**: Dados dos últimos 7 dias
- **Hoje**: Atividades do dia atual

### 4. **Alertas Automáticos**
- ⚠️ Lembretes atrasados são destacados em cada vendedor
- Identifica vendedores que precisam de atenção imediata

### 5. **Detalhes Completos**
Clique em qualquer vendedor para ver detalhes organizados em 4 abas:

#### **Aba 1: Resumo**
Visão consolidada com todas as métricas:
- Métricas gerais de visitas (total, mês, semana, hoje)
- Estatísticas de clientes
- Status de lembretes (atrasados, hoje, esta semana)
- Vendas (em negociação, fechadas, perdidas)
- Valores financeiros
- Plantios ativos por cultura
- Tipos de visita realizadas
- Contatos (total, sucesso, sem resposta)

#### **Aba 2: Clientes**
*(A ser implementada)*
- Lista completa de clientes do vendedor
- Status de cada cliente
- Últimas interações

#### **Aba 3: Visitas**
*(A ser implementada)*
- Histórico detalhado de visitas
- Resultados de cada visita
- Valores negociados

#### **Aba 4: Plantios**
*(A ser implementada)*
- Plantios críticos em fase VT (pendão)
- Estágios fenológicos
- Oportunidades de negociação

### 6. **Exportação para CSV**
- Exporte todos os dados do relatório para planilha Excel/CSV
- Nome do arquivo: `relatorio-vendedores-AAAA-MM-DD.csv`
- Inclui todas as métricas de todos os vendedores
- Formato compatível com Excel, Google Sheets, etc.

## 🚀 Como Usar

### Acessando o Relatório

1. **Faça login como GESTOR**
   - Na tela de login, selecione seu perfil de gestor
   - Digite a senha master configurada no sistema

2. **Navegue até a aba Relatórios**
   - No menu inferior, clique no ícone de gráfico com o texto "Relatórios"
   - A aba só aparece para usuários gestores

### Filtrando por Período

1. **Selecione o período desejado** nos botões no topo:
   - `Total` - Todas as métricas históricas
   - `Mês` - Últimos 30 dias
   - `Semana` - Últimos 7 dias
   - `Hoje` - Somente hoje

2. **Os cards atualizam automaticamente** mostrando as métricas do período selecionado

### Visualizando Detalhes de um Vendedor

1. **Clique em qualquer card de vendedor**
2. **Navegue pelas abas**:
   - `Resumo` - Todas as métricas consolidadas
   - `Clientes` - Lista de clientes *(em breve)*
   - `Visitas` - Histórico de visitas *(em breve)*
   - `Plantios` - Plantios críticos *(em breve)*
3. **Feche o modal** clicando no X ou no botão "Fechar"

### Exportando para CSV

1. **Clique no botão "Exportar CSV"** no topo da tela
2. **O arquivo será baixado automaticamente** com nome `relatorio-vendedores-AAAA-MM-DD.csv`
3. **Abra no Excel ou Google Sheets** para análise detalhada
4. **Características do CSV**:
   - Codificação UTF-8 com BOM (suporta acentos)
   - Separador: vírgula (,)
   - Campos com vírgula são escapados com aspas duplas
   - Compatível com Excel, LibreOffice, Google Sheets

## 📋 Métricas Disponíveis

### Visitas
- **Total de Visitas**: Todas as visitas registradas
- **Visitas Hoje**: Visitas realizadas hoje
- **Visitas Semana**: Visitas dos últimos 7 dias
- **Visitas Mês**: Visitas dos últimos 30 dias
- **Por Tipo**: Prospecção, Análise, Suporte, Pós-venda

### Clientes
- **Total de Clientes**: Todos os clientes ativos
- **Clientes Mês**: Novos clientes nos últimos 30 dias
- **Clientes Semana**: Novos clientes nos últimos 7 dias
- **Com Lembrete**: Clientes com follow-up agendado

### Lembretes
- **Atrasados**: ⚠️ Lembretes que já passaram da data (CRÍTICO)
- **Hoje**: Lembretes para hoje
- **Esta Semana**: Lembretes nos próximos 7 dias

### Vendas
- **Em Negociação**: Propostas em andamento
- **Fechadas**: Vendas concretizadas
- **Perdidas**: Oportunidades perdidas
- **Valores**: Valor em negociação e valor fechado (R$)

### Plantios
- **Plantios Ativos**: Total de plantios em andamento
- **Por Cultura**: Milho, Soja, Grãos separadamente

### Contatos
- **Total de Contatos**: Todas as tentativas de contato
- **Sucesso**: Contatos bem-sucedidos
- **Sem Resposta**: Tentativas sem retorno

## ⚙️ Requisitos Técnicos

### Para Usar o Relatório

1. **Banco de Dados Atualizado**
   - As views `relatorio_vendedores` e `plantios_criticos` devem estar criadas
   - Execute o script `database-relatorio-vendedores.sql` no Supabase

2. **Conexão com Internet (primeira vez)**
   - Para carregar os dados das views
   - Após o primeiro carregamento, funciona offline

3. **Navegador Moderno**
   - Chrome, Firefox, Safari, Edge (versões atuais)
   - Suporte a IndexedDB para armazenamento offline

### Para Gestores

1. **Perfil Master Configurado**
   - Usuário deve ter `isMaster = true` no sistema
   - Senha master configurada

2. **Permissões no Supabase**
   - Acesso de leitura às views:
     - `relatorio_vendedores`
     - `plantios_criticos`

## 🔄 Como os Dados São Atualizados

### Automático
- **Ao fazer login**: Todos os dados são sincronizados
- **Após sincronização**: Quando há alterações no banco
- **Periodicamente**: Se estiver online

### Manual
- **Botão "Atualizar base"**: Na tela de login
- **Trocar de aba**: Volta para Relatórios

## 🐛 Solução de Problemas

### "Acesso restrito a gestores"
**Problema**: Mensagem aparece mesmo sendo gestor
**Solução**:
1. Verifique se fez login como GESTOR (não como vendedor)
2. Confirme que o badge "GESTOR" aparece no canto superior direito
3. Faça logout e login novamente selecionando o perfil de gestor

### Aba Relatórios não aparece
**Problema**: Menu não exibe a aba Relatórios
**Solução**:
1. Confirme que está logado como GESTOR
2. Recarregue a página (Ctrl+F5)
3. Limpe o cache do navegador

### Dados não carregam
**Problema**: Tela de carregamento infinita
**Solução**:
1. Verifique se tem conexão com internet
2. Verifique se as views foram criadas no Supabase:
   ```sql
   SELECT * FROM relatorio_vendedores LIMIT 1;
   SELECT * FROM plantios_criticos LIMIT 1;
   ```
3. Veja o console do navegador (F12) para erros

### Exportação CSV com caracteres estranhos
**Problema**: Acentos aparecem incorretos no Excel
**Solução**:
1. Abra o CSV no Notepad++ ou editor de texto
2. Veja se está em UTF-8
3. No Excel: Dados → De Texto/CSV → Codificação UTF-8

### Métricas zeradas
**Problema**: Todos os valores aparecem como 0
**Solução**:
1. Verifique se há dados cadastrados (clientes, visitas)
2. Verifique o filtro de período selecionado
3. Troque para "Total" para ver todos os dados históricos

## 📊 Interpretando os Dados

### Indicadores de Performance

**Vendedor com Alto Desempenho**:
- ✅ Visitas > 20 no mês
- ✅ Clientes novos > 5 no mês
- ✅ Taxa de conversão > 30% (vendas fechadas / visitas)
- ✅ Sem lembretes atrasados

**Vendedor que Precisa de Atenção**:
- ⚠️ Menos de 10 visitas no mês
- ⚠️ Nenhum cliente novo no mês
- ⚠️ Lembretes atrasados > 5
- ⚠️ Muitas vendas perdidas

**Vendedor Novo / Em Treinamento**:
- 📊 Poucas visitas mas clientes novos crescendo
- 📊 Baixo valor fechado mas alta taxa de negociação
- 📊 Muitos contatos registrados

## 🎓 Dicas de Uso

1. **Acompanhamento Diário**
   - Use o filtro "Hoje" para ver quem está em campo
   - Verifique lembretes atrasados logo pela manhã

2. **Reuniões Semanais**
   - Use o filtro "Semana" para reunião de equipe
   - Exporte CSV para compartilhar com a diretoria

3. **Análise Mensal**
   - Use o filtro "Mês" para avaliar performance mensal
   - Compare com meses anteriores exportando CSV histórico

4. **Planejamento Estratégico**
   - Use o filtro "Total" para visão completa
   - Identifique vendedores que precisam de treinamento
   - Reconheça os top performers

## 🔐 Segurança e Privacidade

- ✅ Apenas gestores têm acesso aos relatórios
- ✅ Vendedores não veem dados de outros vendedores
- ✅ Dados armazenados localmente são protegidos
- ✅ Exportações CSV ficam apenas no dispositivo do gestor
- ✅ Sem exposição de dados sensíveis em URLs

## 📞 Suporte

Se encontrar problemas ou tiver dúvidas:
1. Verifique esta documentação primeiro
2. Consulte o administrador do sistema
3. Reporte bugs na seção "Issues" do projeto

---

**Versão**: 1.0
**Data**: 2026-03-10
**Compatibilidade**: ControlAGRO Web e Mobile
