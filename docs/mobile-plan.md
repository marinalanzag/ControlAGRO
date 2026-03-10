# ControlAGRO Mobile Plan

## Objetivo

Migrar o app web atual para um app iOS/Android offline-first, com sincronizacao segura quando a conexao voltar.

## Fase Atual

Sprint 1 iniciada:

- base do projeto com `package.json`
- pipeline de build para gerar `dist/`
- primeira modularizacao automatica do app legado em `src/`
- arquivo de configuracao inicial do Capacitor

## Proximos Passos

1. Instalar dependencias do Capacitor e gerar `android/` e `ios/`.
2. Parar de depender de extracao automatica do `index.html` legado.
3. Separar manualmente:
   - UI
   - estado global
   - persistencia offline
   - sincronizacao
   - integracoes com Supabase
4. Substituir autenticacao insegura por fluxo real.
5. Validar fluxos offline em dispositivo.

## Escopo do MVP Offline

- abrir o app sem internet depois do primeiro login
- consultar clientes sincronizados localmente
- cadastrar cliente offline
- registrar visita offline
- registrar contato offline
- capturar foto e manter localmente ate sincronizar
- sincronizar automaticamente quando voltar a conexao

## Riscos Conhecidos

- app atual ainda depende de um `index.html` monolitico
- autenticacao e autorizacao nao estao prontas para producao
- sincronizacao offline precisa ser reescrita para lidar com conflitos e erros
- assets e configuracoes de loja ainda nao foram preparados
