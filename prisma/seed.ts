/**
 * Local development seed data.
 *
 * Creates (idempotent - existing rows are left untouched):
 *   - admin@gamerent.local    / Admin12345    (ADMIN)
 *   - customer@gamerent.local / Customer12345 (CUSTOMER)
 *   - 8 units: 3x PC, 3x PS5, 2x VIP
 *
 * Credentials are for local development only.
 * Run with: npm run db:seed  (or: npx prisma db seed)
 */
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

const USERS = [
  {
    email: 'admin@gamerent.local',
    password: 'Admin12345',
    full_name: 'Admin',
    role: 'ADMIN',
  },
  {
    email: 'customer@gamerent.local',
    password: 'Customer12345',
    full_name: 'Demo Customer',
    role: 'CUSTOMER',
  },
]

const UNITS = [
  {
    name: 'Gaming PC 01',
    type: 'PC',
    hourly_rate: 15000,
    description: 'High-refresh gaming rig for competitive FPS and MOBA.',
    specifications: {
      cpu: 'Intel Core i5-13400F',
      gpu: 'NVIDIA RTX 4060',
      ram: '16GB DDR5',
      storage: '1TB NVMe SSD',
      monitor: '24" 165Hz IPS',
      peripherals: ['Mechanical keyboard', 'Gaming mouse', 'Headset'],
      internet: 'Fiber 100 Mbps',
      games: ['Valorant', 'League of Legends', 'Counter-Strike 2'],
    },
  },
  {
    name: 'Gaming PC 02',
    type: 'PC',
    hourly_rate: 15000,
    description: 'Standard gaming workstation for everyday play.',
    specifications: {
      cpu: 'AMD Ryzen 5 5600',
      gpu: 'NVIDIA RTX 3060',
      ram: '16GB DDR4',
      storage: '512GB NVMe SSD',
      monitor: '24" 144Hz IPS',
      peripherals: ['Mechanical keyboard', 'Gaming mouse'],
      internet: 'Fiber 100 Mbps',
      games: ['Valorant', 'Genshin Impact', 'Dota 2'],
    },
  },
  {
    name: 'Gaming PC 03',
    type: 'PC',
    hourly_rate: 18000,
    description: 'Streaming-ready rig with capture card and RGB setup.',
    specifications: {
      cpu: 'Intel Core i7-13700F',
      gpu: 'NVIDIA RTX 4060 Ti',
      ram: '32GB DDR5',
      storage: '1TB NVMe SSD',
      monitor: '27" 180Hz IPS',
      peripherals: ['Mechanical keyboard', 'Gaming mouse', 'Studio mic', 'Webcam'],
      internet: 'Fiber 300 Mbps',
      games: ['Valorant', 'Apex Legends', 'Fortnite'],
    },
  },
  {
    name: 'PS5 Station 01',
    type: 'PS5',
    hourly_rate: 25000,
    description: 'PlayStation 5 console with DualSense controllers.',
    specifications: {
      peripherals: ['2x DualSense controller', '4K TV 55"'],
      internet: 'Fiber 100 Mbps',
      games: ['EA FC 25', 'Spider-Man 2', 'Gran Turismo 7'],
    },
  },
  {
    name: 'PS5 Station 02',
    type: 'PS5',
    hourly_rate: 25000,
    description: 'PlayStation 5 console, great for co-op sessions.',
    specifications: {
      peripherals: ['2x DualSense controller', '4K TV 55"'],
      internet: 'Fiber 100 Mbps',
      games: ['Tekken 8', 'Mortal Kombat 1', 'Call of Duty: BO6'],
    },
  },
  {
    name: 'PS5 Station 03',
    type: 'PS5',
    hourly_rate: 28000,
    description: 'PS5 Disc edition with extra controller and racing wheel.',
    specifications: {
      peripherals: ['2x DualSense controller', 'Racing wheel', '4K TV 65"'],
      internet: 'Fiber 300 Mbps',
      games: ['Gran Turismo 7', 'EA FC 25', 'Rocket League'],
    },
  },
  {
    name: 'VIP Room A',
    type: 'VIP',
    hourly_rate: 50000,
    description: 'Private VIP room with flagship PC and lounge seating.',
    specifications: {
      cpu: 'Intel Core i7-14700K',
      gpu: 'NVIDIA RTX 4070 Super',
      ram: '32GB DDR5',
      storage: '2TB NVMe SSD',
      monitor: '27" 240Hz IPS',
      peripherals: ['Pro keyboard', 'Pro mouse', 'Hi-fi headset'],
      internet: 'Fiber 300 Mbps',
      games: ['All Steam titles', 'Valorant', 'Apex Legends'],
    },
  },
  {
    name: 'VIP Room B',
    type: 'VIP',
    hourly_rate: 60000,
    description: 'VIP room for two with PS5 and PC, ideal for duos.',
    specifications: {
      cpu: 'AMD Ryzen 7 7800X3D',
      gpu: 'NVIDIA RTX 4070 Ti',
      ram: '32GB DDR5',
      storage: '2TB NVMe SSD',
      monitor: '2x 27" 240Hz IPS',
      peripherals: ['2x Pro keyboard', '2x Pro mouse', '2x Headset', 'PS5 console'],
      internet: 'Fiber 300 Mbps',
      games: ['All Steam titles', 'EA FC 25', 'Tekken 8'],
    },
  },
]

async function seedUsers() {
  for (const user of USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: user.email },
    })
    if (existing) {
      console.log(`user exists: ${user.email}`)
      continue
    }
    await prisma.user.create({
      data: {
        email: user.email,
        password_hash: await hash(user.password, 10),
        full_name: user.full_name,
        role: user.role,
      },
    })
    console.log(`created user: ${user.email} (${user.role})`)
  }
}

async function seedUnits() {
  for (const unit of UNITS) {
    const existing = await prisma.unit.findFirst({
      where: { name: unit.name },
    })
    if (existing) {
      console.log(`unit exists: ${unit.name}`)
      continue
    }
    await prisma.unit.create({
      data: {
        name: unit.name,
        type: unit.type,
        hourly_rate: unit.hourly_rate,
        description: unit.description,
        specifications: JSON.stringify(unit.specifications),
        status: 'AVAILABLE',
      },
    })
    console.log(`created unit: ${unit.name} (${unit.type})`)
  }
}

async function main() {
  await seedUsers()
  await seedUnits()
  console.log('Seed complete.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
