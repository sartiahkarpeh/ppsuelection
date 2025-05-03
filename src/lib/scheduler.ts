import cron from 'node-cron'
import fetch from 'node-fetch'

// every day at 9am, check if it's election date
cron.schedule('0 9 * * *', async () => {
  const today = new Date().toISOString().slice(0,10)
  if (today === process.env.ELECTION_DATE) {
    await fetch(`${process.env.APP_URL}/api/admin/generate-cards`, { method: 'POST' })
    console.log('📧 Voting cards emailed to all verified voters')
  }
})

