
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting database integrity cleanup...");

  try {
    // 1. Delete orphan Sessions (sessions pointing to non-existent users)
    // This fixes: [adapter_error_getSessionAndUser] Inconsistent query result
    const deletedSessions = await prisma.$executeRawUnsafe(`
      DELETE FROM "Session" 
      WHERE "userId" NOT IN (SELECT id FROM "User");
    `);
    console.log(`Deleted ${deletedSessions} orphan session(s).`);

    // 2. Delete orphan Accounts (accounts pointing to non-existent users)
    // This fixes the error we saw earlier locally
    const deletedAccounts = await prisma.$executeRawUnsafe(`
      DELETE FROM "Account" 
      WHERE "userId" NOT IN (SELECT id FROM "User");
    `);
    console.log(`Deleted ${deletedAccounts} orphan account(s).`);
    
  } catch (error) {
    console.error("Error cleaning up database:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
