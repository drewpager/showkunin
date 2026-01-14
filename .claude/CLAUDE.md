# Database Considerations
- The database is a Postgres database hosted on Railway and the schema/migrations in /prisma are the source of truth
- Do not run any destructive database commands such as `npx prisma migrate reset` or `npx prisma db push`

# Bash commands
- npm run build: Build the project
- npm run typecheck: Run the typechecker

# Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')

# Workflow
- Be sure to typecheck when you’re done making a series of code changes
- Prefer running single tests, and not the whole test suite, for performance