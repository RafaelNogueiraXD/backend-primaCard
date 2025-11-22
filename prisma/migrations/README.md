# Migrations do Prisma

## 📝 Sobre

Este diretório contém as migrations do banco de dados gerenciadas pelo Prisma.

## 🏗️ Migration Inicial (Baseline)

A migration `20250122000000_init` é uma **baseline migration** criada para um banco de dados que já existe.

### O que é uma Baseline Migration?

Quando você tem um banco de dados existente (criado manualmente ou através de `prisma db push`), você precisa criar uma migration inicial vazia para marcar o estado atual do banco como ponto de partida.

## 🚀 Como Funciona no Deploy

### Vercel / Produção

O comando `vercel-build` executa apenas `prisma generate`, **não** executa migrations automaticamente.

**Por quê?**
- O banco de produção já existe
- Executar migrations em produção requer cuidado
- Evita aplicar migrations acidentalmente

### Aplicar Migrations Manualmente

Se você criar **novas** migrations (após mudanças no schema):

```bash
# 1. Criar nova migration
npx prisma migrate dev --name nome_da_mudanca

# 2. Commitar a migration
git add prisma/migrations
git commit -m "Add migration: nome_da_mudanca"

# 3. Deploy (Vercel aplica automaticamente se configurado)
# OU aplicar manualmente no banco de produção:
npx prisma migrate deploy
```

## ⚠️ IMPORTANTE

### NÃO DELETAR

- ❌ NÃO delete migrations commitadas
- ❌ NÃO edite migrations já aplicadas
- ❌ NÃO ignore `prisma/migrations` no .gitignore

### Migrations devem ser versionadas

As migrations DEVEM estar no Git para que:
- ✅ Vercel possa aplicá-las no deploy
- ✅ Time tenha histórico das mudanças
- ✅ Rollback seja possível

## 📚 Comandos Úteis

```bash
# Ver status das migrations
npx prisma migrate status

# Criar nova migration (desenvolvimento)
npx prisma migrate dev --name descricao_mudanca

# Aplicar migrations (produção)
npx prisma migrate deploy

# Resetar banco (CUIDADO! Perde dados)
npx prisma migrate reset

# Resolver migration como aplicada (baseline)
npx prisma migrate resolve --applied "nome_da_migration"
```

## 🔄 Fluxo de Trabalho

### Desenvolvimento Local

1. Editar `schema.prisma`
2. Executar `npx prisma migrate dev --name minha_mudanca`
3. Testar localmente
4. Commitar migration

### Deploy para Produção

**Opção 1: Automático (Configurado)**
```json
// vercel.json
{
  "scripts": {
    "vercel-build": "prisma generate && prisma migrate deploy"
  }
}
```

**Opção 2: Manual (Recomendado para prod)**
```bash
# Conectar ao banco de produção
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

## 🛡️ Segurança em Produção

### Antes de Aplicar Migrations em Produção:

- [ ] Fazer backup do banco
- [ ] Testar migration em staging
- [ ] Verificar se há breaking changes
- [ ] Considerar downtime necessário
- [ ] Ter plano de rollback

### Migrations Seguras:

✅ Adicionar colunas opcionais
✅ Criar índices
✅ Adicionar tabelas

⚠️ Migrations com Cuidado:

- Renomear colunas (pode quebrar código)
- Deletar colunas (perda de dados)
- Alterar tipos (conversão pode falhar)
- Adicionar NOT NULL sem default

## 📖 Documentação

- [Prisma Migrate](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Baseline Migrations](https://www.prisma.io/docs/guides/database/developing-with-prisma-migrate/add-prisma-migrate-to-a-project)
- [Production Migrations](https://www.prisma.io/docs/guides/deployment/deploy-database-changes-with-prisma-migrate)

## 🆘 Troubleshooting

### "Migration failed to apply"

```bash
# Ver detalhes
npx prisma migrate status

# Marcar como aplicada (se já foi aplicada manualmente)
npx prisma migrate resolve --applied "nome_da_migration"

# Reverter (se possível)
npx prisma migrate resolve --rolled-back "nome_da_migration"
```

### "Shadow database error" (MySQL)

MySQL requer permissões especiais para criar shadow database. Use:

```bash
# Opção 1: Criar migration manualmente
mkdir -p prisma/migrations/YYYYMMDDHHMMSS_nome
touch prisma/migrations/YYYYMMDDHHMMSS_nome/migration.sql
# Editar SQL manualmente
npx prisma migrate resolve --applied "YYYYMMDDHHMMSS_nome"

# Opção 2: Desabilitar shadow database (não recomendado)
# Adicionar em .env:
# PRISMA_MIGRATE_SKIP_GENERATE=true
```

### "Database schema is not empty"

Você precisa fazer baseline:

```bash
# 1. Criar migration vazia
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_init
echo "-- Baseline migration" > prisma/migrations/*/migration.sql

# 2. Marcar como aplicada
npx prisma migrate resolve --applied "nome_da_migration"
```

---

**Última atualização**: Novembro 2025
