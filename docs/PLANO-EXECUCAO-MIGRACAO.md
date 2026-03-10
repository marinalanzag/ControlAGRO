# 🛡️ Plano de Execução Segura da Migração - Agenda Inteligente

## ⚠️ ADVERTÊNCIA CRÍTICA

**Este documento descreve uma operação em banco de dados de produção.**

**LEIA ATENTAMENTE ANTES DE EXECUTAR.**

---

## 📋 Pré-requisitos

Antes de executar a migração, confirme:

- [ ] Você tem acesso ao Supabase SQL Editor
- [ ] Você tem permissões de administrador no projeto
- [ ] O sistema está em uso e possui dados cadastrados
- [ ] Você entende que esta é uma migração **não destrutiva**

---

## 🔒 Garantias de Segurança do Script

O script `database-migration-agenda-SAFE.sql` foi projetado com as seguintes garantias:

### ✅ O que o script FAZ:

1. **Adiciona** duas colunas na tabela `clientes`:
   - `lembrete_data` (DATE)
   - `lembrete_nota` (TEXT)

2. **Cria** a tabela `plantios` (apenas se não existir)

3. **Cria** índices para otimização de performance

4. **Cria** políticas de segurança (RLS) para a tabela `plantios`

5. **Cria** duas views de consulta:
   - `agenda_lembretes`
   - `agenda_plantios`

### ❌ O que o script NÃO FAZ:

- ❌ **NÃO remove** nenhuma tabela existente
- ❌ **NÃO altera** dados existentes de clientes
- ❌ **NÃO altera** dados existentes de visitas
- ❌ **NÃO altera** dados existentes de vendedores
- ❌ **NÃO remove** nenhuma coluna existente
- ❌ **NÃO sobrescreve** estruturas existentes

### ♻️ Idempotência:

O script pode ser executado **múltiplas vezes** sem causar erros:

- Se as colunas já existirem, apenas ignora
- Se a tabela `plantios` já existir, não recria
- Se os índices já existirem, não duplica
- Se as políticas já existirem, recria (para garantir consistência)

---

## 📝 Passo a Passo da Execução

### Etapa 1: Backup Preventivo (Opcional mas Recomendado)

Embora o script seja não destrutivo, é boa prática ter um backup.

**No Supabase:**
1. Vá em **Database** → **Backups**
2. Clique em **Create Backup** (se disponível no seu plano)
3. Ou exporte as tabelas críticas:

```sql
-- Execute estes comandos ANTES da migração para salvar os dados
COPY (SELECT * FROM clientes) TO '/tmp/backup_clientes.csv' CSV HEADER;
COPY (SELECT * FROM vendedores) TO '/tmp/backup_vendedores.csv' CSV HEADER;
COPY (SELECT * FROM visitas) TO '/tmp/backup_visitas.csv' CSV HEADER;
```

⚠️ **Nota:** O Supabase pode não permitir exportação via `COPY TO`. Nesse caso, use a interface do Supabase para exportar.

---

### Etapa 2: Validação Pré-Migração

Execute este script de validação **ANTES** da migração:

```sql
-- SCRIPT DE PRÉ-VALIDAÇÃO
SELECT
    '1. Tabela clientes existe?' as verificacao,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clientes') as resultado
UNION ALL
SELECT
    '2. Total de clientes cadastrados',
    (SELECT COUNT(*)::text FROM clientes)
UNION ALL
SELECT
    '3. Tabela vendedores existe?',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'vendedores')::text
UNION ALL
SELECT
    '4. Total de vendedores cadastrados',
    (SELECT COUNT(*)::text FROM vendedores)
UNION ALL
SELECT
    '5. Tabela visitas existe?',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visitas')::text
UNION ALL
SELECT
    '6. Total de visitas cadastradas',
    (SELECT COUNT(*)::text FROM visitas)
UNION ALL
SELECT
    '7. Coluna lembrete_data já existe?',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'lembrete_data')::text
UNION ALL
SELECT
    '8. Tabela plantios já existe?',
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plantios')::text;
```

**Resultado Esperado:**
- Verificações 1, 3, 5: `true`
- Verificações 2, 4, 6: Números > 0 (mostra que há dados)
- Verificações 7, 8: `false` (indica que a migração é necessária)

**⚠️ Se as verificações 7 ou 8 retornarem `true`, a migração já foi executada anteriormente.**

---

### Etapa 3: Executar a Migração

1. **Acesse o Supabase SQL Editor:**
   - URL: https://app.supabase.com
   - Selecione seu projeto ControlAgro
   - Vá em **SQL Editor** no menu lateral

2. **Abra o arquivo de migração:**
   - Abra o arquivo `database-migration-agenda-SAFE.sql`
   - Copie **TODO** o conteúdo

3. **Cole no SQL Editor**

4. **Clique em RUN** (ou pressione Ctrl/Cmd + Enter)

5. **Aguarde a execução** (deve levar poucos segundos)

---

### Etapa 4: Interpretar os Resultados

Durante a execução, você verá mensagens no console:

#### ✅ Mensagens de Sucesso:

```
NOTICE: ========================================
NOTICE: INICIANDO MIGRAÇÃO DA AGENDA INTELIGENTE
NOTICE: ========================================
NOTICE: ✓ Tabela clientes encontrada
NOTICE: ✓ Tabela vendedores encontrada
NOTICE: ✓ Clientes cadastrados: 42
NOTICE: ✓ Vendedores cadastrados: 4
NOTICE: ✓ Coluna lembrete_data criada em clientes
NOTICE: ✓ Coluna lembrete_nota criada em clientes
NOTICE: ✓ RLS habilitado para tabela plantios
NOTICE: ========================================
NOTICE: VALIDAÇÃO PÓS-MIGRAÇÃO
NOTICE: ========================================
NOTICE: ✓ Total de clientes após migração: 42
NOTICE: ✓ Tabela plantios: CRIADA
NOTICE: ✓ Coluna lembrete_data: CRIADA
NOTICE: ✓ Coluna lembrete_nota: CRIADA
NOTICE: ✓ View agenda_lembretes: CRIADA
NOTICE: ✓ View agenda_plantios: CRIADA
NOTICE: ========================================
NOTICE: MIGRAÇÃO CONCLUÍDA COM SUCESSO!
NOTICE: ========================================
```

#### ⚠️ Mensagens de Aviso (Normais):

```
NOTICE: ○ Coluna lembrete_data já existe em clientes
```

Significa que a coluna já foi criada em execução anterior. **Isso é normal.**

#### ❌ Mensagens de Erro (Críticas):

```
EXCEPTION: ERRO CRÍTICO: Tabela clientes não existe!
```

**Se aparecer esta mensagem:**
- **PARE IMEDIATAMENTE**
- Verifique se você está no projeto correto do Supabase
- Verifique se o banco foi inicializado corretamente

---

### Etapa 5: Validação Pós-Migração

Execute este script de validação **APÓS** a migração:

```sql
-- SCRIPT DE PÓS-VALIDAÇÃO
SELECT
    'VALIDAÇÃO PÓS-MIGRAÇÃO' as titulo,
    '---' as separador;

-- 1. Verificar que nenhum dado foi perdido
SELECT
    'Total de clientes (deve ser igual ao valor anterior)' as verificacao,
    COUNT(*)::text as resultado
FROM clientes
UNION ALL
SELECT
    'Total de vendedores (deve ser igual ao valor anterior)',
    COUNT(*)::text
FROM vendedores
UNION ALL
SELECT
    'Total de visitas (deve ser igual ao valor anterior)',
    COUNT(*)::text
FROM visitas;

-- 2. Verificar novas estruturas
SELECT
    'Tabela plantios criada?' as verificacao,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'plantios')::text as resultado
UNION ALL
SELECT
    'Coluna lembrete_data criada?',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'lembrete_data')::text
UNION ALL
SELECT
    'Coluna lembrete_nota criada?',
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'lembrete_nota')::text
UNION ALL
SELECT
    'View agenda_lembretes criada?',
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'agenda_lembretes')::text
UNION ALL
SELECT
    'View agenda_plantios criada?',
    EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'agenda_plantios')::text;

-- 3. Testar consulta às views
SELECT 'Testando view agenda_lembretes...' as teste;
SELECT * FROM agenda_lembretes LIMIT 1;

SELECT 'Testando view agenda_plantios...' as teste;
SELECT * FROM agenda_plantios LIMIT 1;
```

**Resultado Esperado:**
- Totais de clientes, vendedores e visitas **devem ser iguais aos valores PRÉ-migração**
- Todas as verificações de estruturas devem retornar `true`
- As views devem retornar resultados (mesmo que vazios)

---

### Etapa 6: Teste na Aplicação

1. **Recarregue a aplicação web:**
   - Abra o navegador
   - Pressione **Ctrl+F5** (Windows/Linux) ou **Cmd+Shift+R** (Mac)
   - Faça login

2. **Verifique o Dashboard:**
   - Vá para a aba **Dashboard**
   - Procure a seção **"Agenda Inteligente"**
   - Deve aparecer (mesmo que vazia com mensagem "Nenhum cliente com safra ativa...")

3. **Teste 1 - Adicionar Lembrete:**
   - Vá para a aba **Clientes**
   - Clique em um cliente existente
   - Clique em **Editar**
   - Role até a seção **"Agendar Retorno"**
   - Preencha:
     - **Data Lembrete:** Escolha a data de hoje
     - **Nota do Lembrete:** "Teste de agenda"
   - Clique em **Salvar**
   - Volte ao **Dashboard**
   - O lembrete deve aparecer na **Agenda Inteligente**

4. **Teste 2 - Adicionar Plantio:**
   - Vá para a aba **Clientes**
   - Clique em um cliente existente
   - Role até **"Plantios/Cultivos"**
   - Clique em **"+ Adicionar Plantio"**
   - Preencha:
     - **Cultura:** Milho
     - **Tipo:** Safra
     - **Data Plantio:** 60 dias atrás (calcule a data)
   - Clique em **Salvar**
   - Volte ao **Dashboard**
   - O plantio deve aparecer na **Agenda Inteligente** como "Milho (Safra) - R1-R6, Dia 60"

---

## 🚨 Troubleshooting

### Problema: "Função update_updated_at_column não existe"

**Causa:** O script original `database.sql` não foi executado corretamente.

**Solução:**
```sql
-- Criar a função manualmente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
```

### Problema: "Agenda continua não aparecendo"

**Causa:** O frontend pode estar em cache.

**Solução:**
1. Limpe o cache do navegador
2. Force refresh (Ctrl+F5)
3. Abra o console do navegador (F12) e verifique erros

### Problema: "Erro ao salvar lembrete ou plantio"

**Causa:** Políticas RLS podem estar bloqueando.

**Solução:**
```sql
-- Verificar se as políticas foram criadas
SELECT * FROM pg_policies WHERE tablename = 'plantios';

-- Se estiver vazio, execute manualmente a seção 6 do script
```

### Problema: "Total de clientes mudou após migração"

**Causa:** **CRÍTICO - DADOS PERDIDOS**

**Solução:**
1. **PARE IMEDIATAMENTE**
2. Restaure o backup
3. Entre em contato com suporte
4. **NÃO execute o script novamente**

⚠️ **Nota:** Isso **NÃO DEVE** acontecer com o script fornecido, pois ele é não destrutivo.

---

## 📊 Resumo de Impacto

### Tabelas Modificadas:
- ✏️ `clientes` - Adiciona 2 colunas (não altera dados existentes)

### Tabelas Criadas:
- ➕ `plantios` (nova tabela)

### Views Criadas:
- ➕ `agenda_lembretes` (somente leitura)
- ➕ `agenda_plantios` (somente leitura)

### Dados Afetados:
- ✅ **NENHUM** dado existente é modificado ou removido

### Tempo Estimado:
- **Execução do script:** < 5 segundos
- **Validação:** < 2 minutos
- **Testes na aplicação:** 5-10 minutos
- **Total:** ~15 minutos

---

## ✅ Checklist Final

Antes de considerar a migração concluída, confirme:

- [ ] Script executado sem erros críticos
- [ ] Validação pós-migração passou em todos os testes
- [ ] Total de clientes igual ao valor pré-migração
- [ ] Total de vendedores igual ao valor pré-migração
- [ ] Total de visitas igual ao valor pré-migração
- [ ] Tabela `plantios` criada
- [ ] Colunas `lembrete_data` e `lembrete_nota` criadas
- [ ] Views `agenda_lembretes` e `agenda_plantios` criadas
- [ ] Aplicação web recarregada
- [ ] Seção "Agenda Inteligente" visível no Dashboard
- [ ] Teste de adição de lembrete funcionou
- [ ] Teste de adição de plantio funcionou
- [ ] Lembrete aparece na agenda
- [ ] Plantio aparece na agenda com estágio correto

---

## 📞 Suporte

Se encontrar problemas durante a execução:

1. **NÃO ENTRE EM PÂNICO** - O script é não destrutivo
2. Copie a mensagem de erro completa
3. Execute o script de validação pós-migração
4. Verifique se os dados continuam intactos
5. Se necessário, a migração pode ser revertida removendo as colunas e tabela criadas

### Como Reverter a Migração (se necessário):

```sql
-- ATENÇÃO: Execute APENAS se precisar reverter a migração
-- Isso remove as estruturas criadas, mas NÃO afeta dados de clientes/visitas

DROP VIEW IF EXISTS agenda_plantios;
DROP VIEW IF EXISTS agenda_lembretes;
DROP TABLE IF EXISTS plantios;
ALTER TABLE clientes DROP COLUMN IF EXISTS lembrete_data;
ALTER TABLE clientes DROP COLUMN IF EXISTS lembrete_nota;
```

⚠️ **Nota:** Reverter a migração fará a Agenda Inteligente parar de funcionar novamente.

---

## 🎯 Conclusão

Este plano de execução foi criado para garantir **máxima segurança** durante a migração.

**Lembre-se:**
- O script é **não destrutivo**
- O script é **idempotente**
- Nenhum dado existente será perdido
- A migração pode ser revertida se necessário

**Boa sorte com a migração!** 🚀
