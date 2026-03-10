# 🔧 Como Restaurar a Agenda Inteligente

## 📋 Resumo do Problema

A **Agenda Inteligente** não está aparecendo no sistema ControlAgro (web e mobile) porque **faltam estruturas de banco de dados** que o código espera encontrar.

### ❌ O que está faltando:

1. **Tabela `plantios`** - Armazena os cultivos (milho, soja, etc.) dos clientes
2. **Colunas `lembrete_data` e `lembrete_nota`** na tabela `clientes` - Armazena lembretes/agendamentos

### ✅ O que está funcionando:

- O código frontend da Agenda Inteligente está **implementado e funcional** em [src/scripts/app.js:710-779](src/scripts/app.js#L710-L779)
- A função `renderAgenda()` monta corretamente a agenda combinando:
  - Lembretes de clientes (via `lembrete_data`)
  - Cultivos ativos (via tabela `plantios`)
- O cálculo de estágio fenológico está implementado em [src/scripts/app.js:641-667](src/scripts/app.js#L641-L667)

---

## 🎯 Solução

Execute **um dos dois scripts SQL** abaixo no seu banco de dados Supabase:

### Opção 1: Banco de Dados Novo (Recomendado)

Se você está criando o banco pela primeira vez ou pode recriar:

```bash
# Use o arquivo atualizado
database.sql
```

Este arquivo já foi atualizado e contém **todas as estruturas necessárias**, incluindo:
- Tabela `plantios`
- Colunas `lembrete_data` e `lembrete_nota` em `clientes`
- Índices otimizados
- Views auxiliares (`agenda_lembretes`, `agenda_plantios`)

### Opção 2: Banco de Dados Existente (Migração)

Se você já possui dados em produção e não pode recriar o banco:

```bash
# Use o script de migração
database-migration-agenda.sql
```

Este script adiciona **apenas as estruturas faltantes** sem afetar dados existentes.

---

## 📝 Passo a Passo

### 1. Acesse o Supabase

1. Entre no dashboard do Supabase: https://app.supabase.com
2. Selecione seu projeto ControlAgro
3. Vá em **SQL Editor** no menu lateral

### 2. Execute o Script

**Para banco novo:**
- Copie todo o conteúdo de `database.sql`
- Cole no SQL Editor
- Clique em **Run**

**Para banco existente (migração):**
- Copie todo o conteúdo de `database-migration-agenda.sql`
- Cole no SQL Editor
- Clique em **Run**

### 3. Verifique a Execução

Você deve ver a mensagem:
```
✅ Migração executada com sucesso!
```

### 4. Teste a Agenda

1. Acesse o sistema web ou app mobile
2. Faça login
3. Vá para o **Dashboard**
4. A seção **"Agenda Inteligente"** deve aparecer

---

## 🧪 Como Testar

### Teste 1: Adicionar um Lembrete

1. Acesse um **Cliente**
2. Clique em **Editar**
3. Role até **"Agendar Retorno"**
4. Preencha:
   - **Data Lembrete**: Escolha uma data (hoje ou futura)
   - **Nota do Lembrete**: "Retornar para venda de adubo"
5. Salve
6. Volte ao **Dashboard**
7. O lembrete deve aparecer na **Agenda Inteligente** como:
   ```
   ⚠️ Retornar para venda de adubo
   João Silva • Fazenda Santa Maria
   HOJE (ou data)
   ```

### Teste 2: Adicionar um Cultivo

1. Acesse um **Cliente**
2. Role até **"Plantios/Cultivos"**
3. Clique em **"+ Adicionar Plantio"**
4. Preencha:
   - **Cultura**: Milho
   - **Tipo**: Safra
   - **Data Plantio**: Uma data recente (ex: 60 dias atrás)
5. Salve
6. Volte ao **Dashboard**
7. O cultivo deve aparecer na **Agenda Inteligente** como:
   ```
   🌱 Milho (Safra) - R1-R6
   João Silva • Fazenda Santa Maria
   Dia 60
   ```

---

## 🔍 Como Funciona a Agenda

### Tipos de Eventos

A Agenda Inteligente combina **3 tipos de eventos**:

#### 1️⃣ Lembretes Atrasados
- Cor: **Vermelho**
- Condição: `lembrete_data < hoje`
- Badge: **"ATRASADO"**
- Ícone: ⚠️ Triângulo de alerta

#### 2️⃣ Lembretes Hoje
- Cor: **Azul**
- Condição: `lembrete_data = hoje`
- Badge: **"HOJE"**
- Ícone: 📅 Calendário

#### 3️⃣ Lembretes Futuros (próximos 7 dias)
- Cor: **Cinza**
- Condição: `lembrete_data <= hoje + 7 dias`
- Badge: **Data (ex: "15 mar")**
- Ícone: 📅 Calendário

#### 4️⃣ Cultivos Ativos
- Cor: **Verde**
- Badge: **"Dia X"** (número de dias desde o plantio)
- Ícone: 🌱 Planta
- Mostra o **estágio fenológico**:
  - V2 (dias 0-5): Germinação
  - V3-V4 (dias 6-14): Desenvolvimento Inicial
  - V6-V8 (dias 15-28): Vegetativo
  - V9-V10 (dias 29-42): Pré-pendão
  - VT (dias 43-65): Pendão - **ALERTA DE NEGOCIAÇÃO!**
  - R1-R6 (dias 66-150): Reprodutivo
  - Colhido (após 150 dias): Pós-Safra

#### 5️⃣ Cultivos em Estágio Crítico
- Cor: **Laranja**
- Condição: Estágio VT (pendão) ou Colhido
- Badge: **"Dia X"**
- Destaque: **Negociação ou acompanhamento urgente**

### Ordem de Exibição

Os eventos são ordenados por prioridade:
1. ATRASADO
2. HOJE
3. CICLO_ALERTA (cultivos em estágio crítico)
4. CICLO (cultivos ativos normais)
5. FUTURO (lembretes futuros)

---

## 📊 Estrutura das Tabelas Criadas

### Tabela: `plantios`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | UUID | ID único do plantio |
| `cliente_id` | UUID | Referência ao cliente |
| `cultura` | VARCHAR(100) | Soja, Milho, Grãos, Silagem, Outro |
| `tipo` | VARCHAR(50) | Safra, Safrinha, Teste |
| `data_plantio` | DATE | Data do plantio |
| `ativo` | BOOLEAN | Se o plantio está ativo |
| `created_at` | TIMESTAMP | Data de criação |
| `updated_at` | TIMESTAMP | Data de atualização |

### Colunas Adicionadas: `clientes`

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `lembrete_data` | DATE | Data do lembrete/retorno |
| `lembrete_nota` | TEXT | Nota/descrição do lembrete |

---

## 🚨 Problemas Comuns

### Problema: "Nenhum cliente com safra ativa ou follow-up agendado"

**Causa:** Não há lembretes nem cultivos cadastrados

**Solução:** Cadastre ao menos um lembrete OU um cultivo (veja seção "Como Testar")

### Problema: A agenda não atualiza após adicionar dados

**Causa:** Cache do navegador ou app não sincronizado

**Solução:**
- **Web:** Force refresh (Ctrl+F5 ou Cmd+Shift+R)
- **Mobile:** Puxe para baixo para forçar sincronização

### Problema: Erro ao salvar plantio

**Causa:** Política de segurança RLS bloqueando inserção

**Solução:** Verifique se as políticas públicas foram criadas:
```sql
SELECT * FROM pg_policies WHERE tablename = 'plantios';
```

Devem existir políticas:
- `Permitir leitura pública plantios`
- `Permitir inserção pública plantios`
- `Permitir atualização pública plantios`

---

## 💡 Recursos Adicionais

### Views Criadas

O script cria duas views úteis:

#### `agenda_lembretes`
Retorna todos os lembretes com status calculado (ATRASADO, HOJE, FUTURO)

```sql
SELECT * FROM agenda_lembretes WHERE vendedor_id = 'xxx';
```

#### `agenda_plantios`
Retorna todos os cultivos ativos com dias calculados

```sql
SELECT * FROM agenda_plantios WHERE dias_plantio BETWEEN 43 AND 65;
```

### Arquivos Relacionados

- **Frontend:** [src/scripts/app.js](src/scripts/app.js#L710-L779) - Função `renderAgenda()`
- **Data Loader:** [src/scripts/data-loader.js](src/scripts/data-loader.js#L86-L101) - Função `loadPlantios()`
- **Sync Engine:** [src/scripts/sync-engine.js](src/scripts/sync-engine.js) - Sincronização offline
- **HTML:** [src/index.html](src/index.html#L107-L118) - Componente da Agenda

---

## ✅ Checklist de Verificação

Após executar o script, confirme:

- [ ] Tabela `plantios` existe no Supabase
- [ ] Coluna `lembrete_data` existe em `clientes`
- [ ] Coluna `lembrete_nota` existe em `clientes`
- [ ] Políticas RLS criadas para `plantios`
- [ ] Views `agenda_lembretes` e `agenda_plantios` criadas
- [ ] Sistema web carrega sem erros no console
- [ ] Agenda Inteligente aparece no Dashboard
- [ ] É possível adicionar lembretes em clientes
- [ ] É possível adicionar plantios em clientes
- [ ] Lembretes aparecem na agenda
- [ ] Cultivos aparecem na agenda com estágio correto

---

## 📞 Suporte

Se após executar o script a agenda ainda não aparecer:

1. Verifique o console do navegador (F12) para erros JavaScript
2. Verifique se há erros no network tab ao carregar plantios
3. Confirme que o Supabase está configurado corretamente em `config/`
4. Teste se o usuário tem permissão de leitura nas tabelas

**Causa mais provável:** Tabelas não foram criadas corretamente no Supabase.

**Solução:** Execute novamente o script de migração e verifique a mensagem de sucesso.
