const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Setup cron job to run every 1 minute
const startHoldReleaseWorker = () => {
  cron.schedule('*/1 * * * *', async () => {
    try {
      const now = new Date();
      
      // Update slots with expired HELD status back to OPEN
      const result = await prisma.slot.updateMany({
        where: {
          status: 'HELD',
          heldUntil: { lt: now }
        },
        data: {
          status: 'OPEN',
          heldBy: null,
          heldUntil: null
        }
      });

      if (result.count > 0) {
        console.log(`[Hold Release Job] Released ${result.count} expired slot holds back to OPEN.`);
      }
    } catch (error) {
      console.error('[Hold Release Job] Failed to release expired holds:', error.message);
    }
  });

  console.log('[Hold Release Job] Cron job scheduled to run every 1 minute.');
};

module.exports = {
  startHoldReleaseWorker
};
