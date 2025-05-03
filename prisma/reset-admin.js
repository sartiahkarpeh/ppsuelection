// prisma/reset-admin.js
const { PrismaClient } = require('@prisma/client');
const bcrypt          = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  // 1) delete any existing admins
  await prisma.admin.deleteMany({});

  // 2) hash your new password
  const hash = await bcrypt.hash('Robert@2025', 10);

  // 3) create a fresh admin
  await prisma.admin.create({
    data: {
      email:    'admin@yourdomain.com',
      password: hash,
    },
  });

  console.log('All admins wiped and new admin seeded.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

