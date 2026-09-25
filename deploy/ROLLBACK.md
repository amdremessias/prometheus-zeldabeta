# Deploy — Plano de Rollback (produção)

> Objetivo: voltar ao último estado conhecido-bom se um deploy/mudança quebrar um serviço em produção.
> Leia a **seção 1 (antecipação)** antes de qualquer deploy e a **seção correspondente ao cenário** quando o serviço quebrar.
> Todo deploy deve ser feito SOMENTE a partir de um estado validado (tsc + lint + build + smoke test) — ver `STABLE-VERSION.md`.

---

## 1. Antes de deployar (antecipação de risco)

| Ação | Quando | Onde |
|------|--------|------|
| Backup do banco | Antes de **toda** atualização de app/stack | `deploy/multi-client/backup-client.sh <cliente>` (ou `docker compose exec db pg_dump` no stack único) |
| Deixar versão atual marcada | Antes de rebuild | `git tag rollback-<data>` (ex.: `rollback-2026-08-12`) ou anotar a tag/commit atual no `STABLE-VERSION.md` |
| Registry dos clientes | Conferir antes de provisionar | `deploy/multi-client/list-clients.sh` |
| DNS `*.internal.lab` | Conferir antes de `add-client.sh` | `dig +short xclient.internal.lab` deve retornar o IP da VPS |
| nginx intacto | Não quebrar o site em edição | `install.sh` só adiciona arquivos em `sites-enabled/`; nunca editar manualmente um `zeldapdv-*.conf` (são gerados) |

**Princípio:** as mudanças de multi-cliente são **aditivas** — o stack único original (porta 3000, `deploy/deploy.sh`) não é tocado. Rollback mais simples = parar/remover o que foi adicionado e voltar a apontar nginx para o stack antigo.

---

## 2. Onde está cada parte do estado

| Parte | Local |
|-------|-------|
| Código fonte | repositório (no VPS: clone em `~/restaurante-tech-main` ou onde rodou o `deploy.sh`) |
| Banco de dados (cliente N) | volume docker `zeldapdv_<cliente>_pgdata` (Postgres por cliente) |
| Banco de dados (stack único legado) | volume `zeldapdv_pgdata` |
| Config de cada cliente | `clients/<cliente>/.env` (segredos únicos) |
| Certificado wildcard | `/etc/nginx/ssl/internal.lab/{wildcard.pem,wildcard-key.pem}` |
| Config nginx por cliente | `/etc/nginx/sites-enabled/zeldapdv-<cliente>.conf` (gerados) |
| Backups | `deploy/multi-client/backups/<cliente>/` |

---

## 3. Cenários e procedimentos de rollback

A ordem de gravidade é crescente: recuperar um cliente → recuperar um app atualizado → recuperar o servidor inteiro.

### 3.1 — Cliente novo quebrou logo após `add-client.sh`

Sintomas: app não responde em `https://<cliente>.internal.lab`, ou `curl http://127.0.0.1:<porta>/login` falha.

```bash
# 1. Ver o que aconteceu
deploy/multi-client/list-clients.sh
docker compose -p <cliente> -f clients/<cliente>/docker-compose.yml ps

# 2. Se foi erro de build/deploy do app: rebuild e sobe de novo (idempotente)
deploy/multi-client/add-client.sh <cliente>

# 3. Se ainda quebrou: até o serviço, mantendo os dados do volume
docker compose -p <cliente> -f clients/<cliente>/docker-compose.yml down

# 4. Remover do nginx (o stack deixa de ser servido; dados preservados)
deploy/multi-client/remove-client.sh <cliente>            # sem --purge

# 5. (opcional) Cobrir: restaurar do backup se necessário
gunzip -c backups/<cliente>/pgdump-<timestamp>.sql.gz | \
    docker exec -i zeldapdv-<cliente>-db pg_restore -U <db_user> -d <db_name>
```

### 3.2 — Um app de cliente existente quebrou após atualização (rebuild)

Sintomas: clientes antigos OK, `xclient` caiu depois de um `add-client.sh`/rebuild novo.

```bash
# 1. Apontar IMEDIATO para a última imagem conhecida-boa (se existir tag antiga)
docker tag zeldapdv:xclient zeldapdv:xclient-backup-quebrado    # preserva a quebrada p/ análise
# 2. Reconstruir a partir da versão estável do código
git checkout rollback-<data>                                    # ou tag/anotação da versão estável
deploy/multi-client/add-client.sh xclient                      # refaz build + sobe + nginx
# 3. Se o volume de dados foi afetado, restaurar backup (seção 3.1 passo 5)
```

### 3.3 — nginx quebrou (comando anterior falhou em `nginx -t`)

Sintomas: todos os clientes sem resposta; `nginx -t` acusa erro.

```bash
# 1. Testar a configuração; a saída aponta o arquivo e linha do erro
sudo nginx -t

# 2. Se o problema é um conf novo, removê-lo só é seguro se o stack continua up sem ele.
#    MAS o correto é corrigir o arquivo gerado: os confs NÃO são editados à mão.
#    Regenere pelo script (ele mesmo roda nginx -t antes de reload):
deploy/multi-client/add-client.sh <cliente-com-erro>

# 3. Se o nginx não sobe de jeito nenhum (config global corrompida), restaurar a config
#    da última boa que você tenha anotado antes do deploy (ex.: cópia em /etc/nginx/bak).
ls /etc/nginx/sites-enabled/           # confs gerados → ver quais foram adicionados
sudo rm /etc/nginx/sites-enabled/zeldapdv-<cliente>.conf
sudo nginx -t && sudo systemctl reload nginx

# 4. Se ainda não subir, reiniciar o serviço:
sudo systemctl restart nginx
```

### 3.4 — Banco de um cliente corrompido / alteração de dados indesejada

```bash
# Parar o app para não escrever em cima
docker compose -p <cliente> -f clients/<cliente>/docker-compose.yml stop app

# Restaurar o dump mais recente (na ordem: última boa)
gunzip -c backups/<cliente>/pgdump-<timestamp>.sql.gz | \
    docker exec -i zeldapdv-<cliente>-db pg_restore -U <db_user> -d <db_name>

# Subir de volta
docker compose -p <cliente> -f clients/<cliente>/docker-compose.yml start app
```

### 3.5 — Servidor inteiro quebrou (deploy global / imagem base / migração)

Sintomas: nada responde; docker/nginx fora do ar; imagem da aplicação não sobe.

```bash
# 0. LINHA DO TEMPO: anotar a última versão validada (STABLE-VERSION.md / tag rollback-*).
# 1. Voltar o código
git checkout rollback-<data>
# 2. Reconstruir TODAS as stacks a partir do código estável
for c in xclient yclient wclient; do deploy/multi-client/add-client.sh "$c"; done
# 3. Certificado wildcard: não apaga (reutilizado pelo install.sh). Se sumiu, regenerar:
deploy/multi-client/install.sh
# 4. Recovery do Postgres: os volumes NÃO são apagados por `docker compose down`.
#    Se o volume foi perdido (docker volume rm), restaurar o backup da seção 3.4 por cliente.
```

---

## 4. Retomada de deploy normal

Rodar o `install.sh` **é idempotente** (certificado e estrutura só são criados se faltarem). Depois de um rollback:

1. Conferir `list-clients.sh` — cada linha = pasta `clients/<cliente>/` + porta no nginx.
2. Conferir `nginx -t`.
3. Revalidar gates: `npx tsc --noEmit && npm run lint && npm run build`.
4. `add-client.sh` para cada cliente que precisar voltar (mantém dados dos volumes).

---

## 5. Ferramentas de apoio

| Comando | Pra que serve |
|---------|---------------|
| `add-client.sh <c>` | provisionar/rebuild de um cliente (idempotente) |
| `remove-client.sh <c>` | parar e tirar do nginx (dados preservados; `--purge` apaga volume) |
| `backup-client.sh <c>` | `pg_dump` → `backups/<c>/pgdump-<ts>.sql.gz` |
| `list-clients.sh` | estado de todos os clientes (registro + apps) |
| `repo/STABLE-VERSION.md` | changelog com a versão validada de cada mudança |