// prisma/seed-admin.js
const { PrismaClient } = require('@prisma/client')
const bcrypt          = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('Robert@2025', 10)
  await prisma.admin.upsert({
    where:  { email: 'admin@yourdomain.com' },
    update: { password: hash },
    create: {
      email:    'admin@yourdomain.com',
      password: hash,
    },
  })
}

main()
  .then(() => {
    console.log('Admin user seeded.')
  })
  .catch(console.error)
  .finally(() => prisma.$disconnect())

