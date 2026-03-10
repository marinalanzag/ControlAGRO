# Runtime Config

O app continua funcionando com o fallback atual, entao o sistema web existente nao para.

## Como funciona

O arquivo [runtime-config.js](/Users/marinalanza/ControlAGRO-main/src/scripts/runtime-config.js) e carregado antes de [app-config.js](/Users/marinalanza/ControlAGRO-main/src/scripts/app-config.js).

Se `window.__CONTROLAGRO_CONFIG__` estiver vazio, o app usa o fallback atual do projeto.

Se voce quiser apontar o app mobile para outro ambiente, altere apenas:

- [runtime-config.js](/Users/marinalanza/ControlAGRO-main/src/scripts/runtime-config.js)

## Exemplo

```js
window.__CONTROLAGRO_CONFIG__ = {
  supabaseUrl: "https://seu-projeto.supabase.co",
  supabaseAnonKey: "sua-chave-anon"
};
```

## Estrategia segura

- Web atual: continua no fallback existente.
- Mobile em homologacao: pode usar outro `runtime-config.js`.
- Mobile em producao: usa config propria sem editar o codigo principal.

## Proximo passo recomendado

Quando formos empacotar builds reais, vale gerar esse arquivo por ambiente e evitar manter os valores hardcoded no fallback.

## Scripts de build por ambiente

- `npm run build:dev`
- `npm run build:homolog`
- `npm run build:prod`
- `npm run cap:sync:homolog`
- `npm run cap:sync:prod`

Os arquivos usados ficam em:

- [dev.json](/Users/marinalanza/ControlAGRO-main/config/environments/dev.json)
- [homolog.json](/Users/marinalanza/ControlAGRO-main/config/environments/homolog.json)
- [prod.json](/Users/marinalanza/ControlAGRO-main/config/environments/prod.json)

Durante o build, o arquivo `dist/scripts/runtime-config.js` e gerado automaticamente a partir desse ambiente.

## Identidade do app por ambiente

Os mesmos arquivos de ambiente tambem definem:

- `appId`
- `appName`

Scripts disponiveis:

- `npm run config:default`
- `npm run config:dev`
- `npm run config:homolog`
- `npm run config:prod`

E os syncs completos por ambiente:

- `npm run cap:sync:dev`
- `npm run cap:sync:homolog`
- `npm run cap:sync:prod`

Esses scripts atualizam [capacitor.config.json](/Users/marinalanza/ControlAGRO-main/capacitor.config.json) antes do `cap sync`.
