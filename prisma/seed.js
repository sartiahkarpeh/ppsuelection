// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emails = [
    'sando231@gmail.com',
    'sartiah231@gmail.com',
    'charles231@gmail.com'
    // …add as many as you like
  ];

  for (const email of emails) {
    await prisma.partyRep.upsert({
      where:  { email },
      update: {},
      create: { email },
    });
    console.log(`✔️  Upserted ${email}`);
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

