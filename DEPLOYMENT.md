# Deployment Guide

## Database

- **Provider**: PostgreSQL on [Railway](https://railway.app)
- **ORM**: Prisma 4.12.0
- **Schema**: `prisma/schema.prisma`
- **Relation mode**: `prisma` (no foreign key constraints at the DB level)

## Environment Variables

Environment files are encrypted using [dotenvx](https://dotenvx.com/encryption). Keys are stored in `.env.keys` (gitignored).

| File | Purpose |
|------|---------|
| `.env` | Development (currently points to production DB) |
| `.env.production` | Production |

To decrypt/encrypt env files:

```bash
npm run env:decrypt   # Decrypt .env files
npm run env:encrypt   # Re-encrypt .env files
npm run env:keys      # Show encryption keys
```

## Prisma Database Migrations

### Check migration status

```bash
# Against the default .env DATABASE_URL
npx dotenvx run -- npx prisma migrate status

# Against production specifically
npx dotenvx run -f .env.production -- npx prisma migrate status
```

### Create a new migration (development)

```bash
# 1. Edit prisma/schema.prisma with your changes

# 2. Generate and apply the migration
npx dotenvx run -- npx prisma migrate dev --name describe_your_change

# This will:
#   - Generate a new SQL migration file in prisma/migrations/
#   - Apply it to the database
#   - Regenerate Prisma Client
```

### Apply pending migrations to production

```bash
# Deploy runs migrations without generating new ones (safe for production)
npx dotenvx run -f .env.production -- npx prisma migrate deploy
```

### Reset the database (destructive - development only)

```bash
# WARNING: This drops and recreates the entire database
npx dotenvx run -- npx prisma migrate reset
```

### Seed the database

```bash
npm run db-seed
# Runs: dotenvx run -- NODE_ENV=development prisma db seed
# Seed script: prisma/seed.ts
```

### Regenerate Prisma Client (no DB changes)

```bash
npx prisma generate
# Also runs automatically via the `postinstall` script
```

## Migration History

| Migration | Description |
|-----------|-------------|
| `20251120153524` | Add AI analysis fields to Video |
| `20260103192200` | Add Gemini caching fields |
| `20260114160638` | Add agent execution models (AgentRun, AgentLog, AgentCheckpoint, TaskCredential) |
| `20260115142811` | Add structured agent log fields |
| `20260116144452` | Add BrowserSession model |
| `20260117211934` | Add BrowserbaseContext, BrowserbaseActiveSession, CodeExecution models |

## Build & Deploy

```bash
# Production build (uses .env.production)
npm run build

# Start production server
npm run start
```

## Important Notes

- The `DATABASE_URL` in `.env` currently points to the **production database**. Be careful when running destructive commands like `migrate reset`.
- Use `DEV_DATABASE_URL` in `.env.production` if you need a separate dev database reference.
- Prisma Client is regenerated on every `npm install` via the `postinstall` hook.
- The schema uses `relationMode = "prisma"`, meaning referential integrity is enforced at the Prisma level, not via database foreign keys.
