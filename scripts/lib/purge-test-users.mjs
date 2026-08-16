/**
 * Remove temporary *@pahadlink.test / seller seed users left by smoke tests.
 * Keeps the single seeded admin account and any real customer accounts.
 */
import 'dotenv/config'
import { connectDB, disconnectDB } from '../../server/config/db.js'
import User from '../../server/models/User.js'

export async function purgeTestUsers() {
  await connectDB()
  try {
    const result = await User.deleteMany({
      $or: [
        { email: /@pahadlink\.test$/i },
        { email: /^seller@pahadlink\.com$/i },
        { username: /^seller$/i },
      ],
    })
    return result.deletedCount || 0
  } finally {
    await disconnectDB()
  }
}
