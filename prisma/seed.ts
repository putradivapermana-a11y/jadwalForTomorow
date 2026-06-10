import 'dotenv/config'
import prisma from '../src/lib/prisma'

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    console.error('ERROR: Seed script cannot be run in production without ALLOW_PROD_SEED=true');
    process.exit(1);
  }

  console.log('Clearing old dev data...');
  await prisma.scheduleBlock.deleteMany({});
  await prisma.dailyPlan.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.fixedEvent.deleteMany({});
  await prisma.userProfile.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('Seeding MVP demo data...');

  const user = await prisma.user.create({
    data: {
      id: 'demo-user-1',
      email: 'user@example.com',
      name: 'Default User',
      profile: {
        create: {
          currentRole: 'Software Engineer',
          currentPhase: 'Building a startup MVP',
          passions: 'AI, coding, coffee',
          shortTermGoals: 'Finish MVP this month',
          longTermGoals: 'Build sustainable business',
          priorities: 'Work: 70%, Health: 20%, Social: 10%',
          productiveHours: '09:00-12:00, 14:00-17:00',
          lowEnergyHours: '13:00-14:00',
          sleepPreference: '23:00-07:00',
          freeTimePolicy: 'Read or play games',
          lifeConstraints: 'Must walk dog at 8am and 6pm',
        }
      }
    },
  })

  // Date math for seeding
  const now = new Date();
  const today = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  console.log(`Using base date (Tomorrow): ${tomorrow.toISOString()}`);

  // 1. Create Sample Tasks
  const task1 = await prisma.task.create({
    data: {
      userId: user.id,
      title: 'Review PRs',
      duration: 30,
      priority: 3,
      status: 'TODO'
    }
  });

  const task2 = await prisma.task.create({
    data: {
      userId: user.id,
      title: 'Write MVP Docs',
      duration: 60,
      priority: 5,
      status: 'TODO'
    }
  });

  // 2. Create Sample Events
  const event1Start = new Date(tomorrow);
  event1Start.setHours(10, 0, 0, 0);
  const event1End = new Date(tomorrow);
  event1End.setHours(11, 0, 0, 0);

  const event1 = await prisma.fixedEvent.create({
    data: {
      userId: user.id,
      title: 'Sync Team',
      startTime: event1Start,
      endTime: event1End,
      status: 'ACTIVE'
    }
  });

  const event2Start = new Date(tomorrow);
  event2Start.setHours(14, 0, 0, 0);
  const event2End = new Date(tomorrow);
  event2End.setHours(15, 0, 0, 0);

  await prisma.fixedEvent.create({
    data: {
      userId: user.id,
      title: 'Client Demo (Cancelled)',
      startTime: event2Start,
      endTime: event2End,
      status: 'CANCELLED'
    }
  });

  // 3. Create Daily Plan
  await prisma.dailyPlan.create({
    data: {
      userId: user.id,
      date: tomorrow,
      status: 'ACTIVE',
      blocks: {
        create: [
          {
            userId: user.id,
            blockType: 'FIXED_EVENT',
            title: 'Sync Team',
            startTime: event1Start,
            endTime: event1End,
            referenceId: event1.id,
            status: 'ACTIVE',
            isLocked: true
          },
          {
            userId: user.id,
            blockType: 'TASK',
            title: 'Write MVP Docs',
            startTime: new Date(tomorrow.setHours(11, 0, 0, 0)),
            endTime: new Date(tomorrow.setHours(12, 0, 0, 0)),
            referenceId: task2.id,
            status: 'ACTIVE',
            isLocked: false
          },
          {
            userId: user.id,
            blockType: 'TASK',
            title: 'Review PRs',
            startTime: new Date(tomorrow.setHours(13, 0, 0, 0)),
            endTime: new Date(tomorrow.setHours(13, 30, 0, 0)),
            referenceId: task1.id,
            status: 'ACTIVE',
            isLocked: false
          }
        ]
      }
    }
  });

  console.log(`Demo user created: ${user.email}`);
  console.log(`Seed complete. Created tasks, events, and 1 daily plan for tomorrow.`);
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })