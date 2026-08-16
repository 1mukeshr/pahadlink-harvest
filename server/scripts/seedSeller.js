import 'dotenv/config'
import { connectDB, disconnectDB, getMongoDbName } from '../config/db.js'
import User from '../models/User.js'

/**
 * Seller desk test account:
 *   username: seller  (SELLER_USERNAME)
 *   password: seller123 (SELLER_PASSWORD)
 */
async function seed() {
  await connectDB()

  const email = process.env.SELLER_EMAIL || 'seller@pahadlink.com'
  const username = process.env.SELLER_USERNAME || 'seller'
  const password = process.env.SELLER_PASSWORD || 'seller123'

  let user = await User.findOne({ $or: [{ email }, { username }] }).select(
    '+password'
  )

  if (user) {
    user.role = 'seller'
    user.isActive = true
    user.email = email
    user.username = username
    user.name = user.name || 'PahadLink Seller'
    user.password = password
    user.markModified('password')
    await user.save()
    console.log(`Updated existing user to seller: ${username}`)
  } else {
    await User.create({
      name: 'PahadLink Seller',
      email,
      username,
      password,
      role: 'seller',
    })
    console.log(`Created seller user: ${username}`)
  }

  const check = await User.findOne({ username }).select('+password')
  const ok = check && (await check.comparePassword(password))
  if (!ok) {
    throw new Error(
      'Seller password hash check failed. Password was not stored correctly.'
    )
  }

  console.log({
    database: getMongoDbName(),
    email,
    username,
    password,
    role: 'seller',
    login: '/admin/login',
  })

  await disconnectDB()
}

seed().catch(async (err) => {
  console.error(err)
  try {
    await disconnectDB()
  } catch {
    /* ignore */
  }
  process.exit(1)
})
