import 'dotenv/config'
import prisma from '../src/lib/prisma'

async function main() {
  const user = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
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

  console.log({ user })
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