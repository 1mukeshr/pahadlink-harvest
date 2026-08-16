import 'dotenv/config'
import { connectDB, disconnectDB, getMongoDbName } from '../config/db.js'
import User from '../models/User.js'

/**
 * Single project test account only:
 *   username: admin  (ADMIN_USERNAME)
 *   password: admin123 (ADMIN_PASSWORD)
 * Removes leftover smoke/seller seed users from the DB.
 */
async function seed() {
  await connectDB()

  const email = process.env.ADMIN_EMAIL || 'admin@pahadlink.com'
  const username = process.env.ADMIN_USERNAME || 'admin'
  const password = process.env.ADMIN_PASSWORD || 'admin123'

  // Drop automated test / extra seed accounts — keep main admin (+ optional seller).
  const purge = await User.deleteMany({
    $or: [
      { email: /@pahadlink\.test$/i },
      {
        role: { $in: ['admin', 'seller'] },
        email: { $nin: [email, 'seller@pahadlink.com'] },
        username: { $nin: [username, 'seller'] },
      },
    ],
  })
  if (purge.deletedCount) {
    console.log(`Removed ${purge.deletedCount} extra test/seed account(s)`)
  }

  let user = await User.findOne({ $or: [{ email }, { username }] }).select(
    '+password'
  )

  if (user) {
    user.role = 'admin'
    user.isActive = true
    user.email = email
    user.username = username
    user.name = user.name || 'PahadLink Admin'
    user.password = password
    user.markModified('password')
    await user.save()
    console.log(`Updated existing user to admin: ${username}`)
  } else {
    await User.create({
      name: 'PahadLink Admin',
      email,
      username,
      password,
      role: 'admin',
    })
    console.log(`Created admin user: ${username}`)
  }

  const check = await User.findOne({ username }).select('+password')
  const ok = check && (await check.comparePassword(password))
  if (!ok) {
    throw new Error(
      'Admin password hash check failed. Password was not stored correctly.'
    )
  }

  const others = await User.countDocuments({
    role: 'admin',
    _id: { $ne: check._id },
  })
  if (others > 0) {
    throw new Error(
      `Expected a single admin test account, found ${others} other admin(s).`
    )
  }

  console.log({
    database: getMongoDbName(),
    email,
    username,
    password,
    role: check.role,
    loginCheck: 'ok',
    note: 'Only this one test account is seeded for the project.',
  })

  await disconnectDB()
}

seed().catch((err) => {
  console.error(err.message || err)
  console.error('Tip: Make sure MongoDB is running on your PC.')
  process.exit(1)
})
