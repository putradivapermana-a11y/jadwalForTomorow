import * as dotenv from 'dotenv'
dotenv.config()

import { Pool, neonConfig } from '@neondatabase/serverless'
import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@prisma/client'
import ws from 'ws'

neonConfig.webSocketConstructor = ws

const prismaClientSingleton = () => {
  const fallbackUrl = "postgresql://neondb_owner:npg_EX73mobTayZn@ep-lively-mountain-ao85id6o.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
  const connectionString = process.env.DATABASE_URL || fallbackUrl;
  const pool = new Pool({ connectionString })
  const adapter = new PrismaNeon(pool)
  return new PrismaClient({ adapter, log: ['error'] })
}

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prisma ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma