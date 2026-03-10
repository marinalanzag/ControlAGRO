# 🔧 Correção: Erro na Função EXTRACT

## ❌ Erro Encontrado

Ao executar o script de migração, ocorreu o seguinte erro:

```
ERROR: 42883: function pg_catalog.extract(unknown, integer) does not exist
LINE 197: EXTRACT(DAY FROM (CURRENT_DATE - p.data_plantio)) as dias_plantio,
HINT: No function matches the given name and argument types. You might need to add explicit type casts.
```

---

## 🔍 Causa do Erro

### Código Problemático:
```sql
EXTRACT(DAY FROM (CURRENT_DATE - p.data_plantio)) as dias_plantio
```

### Por que falhou?

No PostgreSQL, quando subtraímos duas datas (`DATE - DATE`), o resultado é um **número inteiro** representando os dias de diferença, **NÃO** um `INTERVAL`.

A função `EXTRACT(DAY FROM ...)` espera um tipo `INTERVAL`, `TIMESTAMP` ou `TIME`, mas recebeu um `INTEGER`.

**Exemplo:**
```sql
SELECT CURRENT_DATE - '2024-01-01'::DATE;
-- Resultado: 69 (tipo INTEGER)

SELECT EXTRACT(DAY FROM CURRENT_DATE - '2024-01-01'::DATE);
-- ERRO: EXTRACT não aceita INTEGER
```

---

## ✅ Solução Aplicada

### Código Corrigido:
```sql
(CURRENT_DATE - p.data_plantio)::INTEGER as dias_plantio
```

### Por que funciona?

A subtração `CURRENT_DATE - p.data_plantio` **já retorna um inteiro** representando os dias de diferença. Apenas fazemos um cast explícito para `INTEGER` para garantir o tipo correto.

**Exemplo:**
```sql
SELECT (CURRENT_DATE - '2024-01-01'::DATE)::INTEGER;
-- Resultado: 69 (tipo INTEGER explícito)
```

---

## 📊 Comparação

| Abordagem | Resultado | Funciona? |
|-----------|-----------|-----------|
| `EXTRACT(DAY FROM (CURRENT_DATE - p.data_plantio))` | ❌ Erro de tipo | Não |
| `(CURRENT_DATE - p.data_plantio)` | ✅ INTEGER implícito | Sim (mas sem tipo explícito) |
| `(CURRENT_DATE - p.data_plantio)::INTEGER` | ✅ INTEGER explícito | **Sim (MELHOR)** |

---

## 🔧 Arquivos Corrigidos

### 1. `database-migration-agenda-SAFE.sql`
**View `agenda_plantios` corrigida:**
```sql
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
    (CURRENT_DATE - p.data_plantio)::INTEGER as dias_plantio,  -- ✅ CORRIGIDO
    c.vendedor_id,
    v.nome as vendedor_nome
FROM plantios p
LEFT JOIN clientes c ON p.cliente_id = c.id
LEFT JOIN vendedores v ON c.vendedor_id = v.id
WHERE p.ativo = true
  AND c.ativo = true
  AND p.data_plantio <= CURRENT_DATE
ORDER BY p.data_plantio DESC;
```

### 2. `database.sql`
**Mesma correção aplicada.**

---

## ✅ Próximo Passo

**Execute o script corrigido:**

```bash
database-migration-agenda-SAFE.sql
```

O erro **NÃO OCORRERÁ MAIS**.

---

## 🧪 Teste da Correção

Você pode testar a nova sintaxe diretamente no SQL Editor do Supabase:

```sql
-- Teste 1: Verificar tipo de retorno
SELECT pg_typeof(CURRENT_DATE - '2024-01-01'::DATE);
-- Resultado: integer

-- Teste 2: Calcular dias de diferença
SELECT (CURRENT_DATE - '2024-01-01'::DATE)::INTEGER as dias;
-- Resultado: 69 (ou o número de dias até hoje)

-- Teste 3: Testar a view (após criar a tabela plantios)
SELECT * FROM agenda_plantios LIMIT 1;
-- Deve funcionar sem erro
```

---

## 📝 Resumo

| Item | Status |
|------|--------|
| **Erro identificado** | ✅ Sim |
| **Causa entendida** | ✅ Tipo incorreto para EXTRACT |
| **Solução aplicada** | ✅ Cast direto para INTEGER |
| **Scripts corrigidos** | ✅ Ambos (SAFE e database.sql) |
| **Pronto para executar** | ✅ Sim |

---

## 🚀 Conclusão

O erro foi **corrigido** em todos os arquivos.

**Pode executar o script novamente sem problemas.**

A view `agenda_plantios` agora calcula corretamente os dias desde o plantio usando:
```sql
(CURRENT_DATE - p.data_plantio)::INTEGER
```

Esta é a forma correta e mais eficiente de calcular diferença de dias no PostgreSQL.
