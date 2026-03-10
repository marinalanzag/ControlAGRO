# Native Release Baseline

## Permissoes aplicadas

Android:

- Internet
- Localizacao aproximada
- Localizacao precisa
- Camera

iOS:

- Camera
- Localizacao em uso
- Biblioteca de fotos

## Scripts por ambiente

- `npm run cap:sync`
- `npm run cap:sync:dev`
- `npm run cap:sync:homolog`
- `npm run cap:sync:prod`

Esses scripts agora:

1. atualizam o `capacitor.config.json`
2. geram os assets web do ambiente
3. executam `cap sync`
4. reaplicam identidade nativa e permissoes

## Ajustes ainda pendentes antes de loja

- preencher `supabaseUrl` e `supabaseAnonKey` reais por ambiente
- definir icones e splash finais
- revisar textos finais de permissoes com area juridica/produto
- ajustar versionamento de release
- validar build real em dispositivo Android
- validar archive iOS no Xcode
