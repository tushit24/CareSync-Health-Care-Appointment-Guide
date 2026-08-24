const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const adminEmail = 'admin@caresync.com';
  const adminPassword = 'AdminPassword123!';
  
  console.log('Seeding database...');
  
  // Check if admin already exists
  let existingAdmin;
  try {
    existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });
  } catch (error) {
    console.error('Failed to query database. Ensure your database is running and migrations are applied.');
    throw error;
  }
  
  if (existingAdmin) {
    console.log(`Admin user with email ${adminEmail} already exists. Skipping.`);
    return;
  }
  
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      phone: '+15550199'
    }
  });
  
  console.log(`Admin user created: ${admin.email}`);
  console.log(`Password: ${adminPassword}`);
  console.log('Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
