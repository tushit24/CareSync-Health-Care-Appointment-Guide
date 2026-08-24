require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const rows = await prisma.notificationLog.findMany({
      where: { status: 'PENDING', attempts: { lt: 3 } },
      include: {
        appointment: {
          include: {
            patient: { select: { name: true, email: true } },
            doctor: {
              select: {
                specialisation: true,
                user: { select: { name: true, email: true } }
              }
            },
            slot: { select: { date: true, startTime: true, endTime: true } }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    console.log('Query OK. Pending rows:', rows.length);
    rows.forEach(r => {
      const appt = r.appointment;
      console.log(
        ` - [${r.status}] ${r.type}/${r.channel}`,
        appt ? `| Patient: ${appt.patient?.name} | Doctor: ${appt.doctor?.user?.name}` : '| no appt'
      );
    });
    if (rows.length === 0) {
      console.log('No stuck PENDING rows found — all already processed or none exist yet.');
    }
  } catch (e) {
    console.error('ERROR:', e.message);
  } finally {
    await prisma.$disconnect();
  }
})();
