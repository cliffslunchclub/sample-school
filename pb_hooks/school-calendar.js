// Eastern school calendar, independent of the host's timezone. US DST rules
// since 2007: second Sunday in March at 07:00 UTC, first Sunday in November
// at 06:00 UTC. No Intl dependency: PocketBase's JS engine does not provide it.
module.exports = {
  orderingCalendar: (now) => {
    const year = now.getUTCFullYear()
    const marchSunday = 1 + ((7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7) + 7
    const novemberSunday = 1 + ((7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7)
    const dst = now.getTime() >= Date.UTC(year, 2, marchSunday, 7) && now.getTime() < Date.UTC(year, 10, novemberSunday, 6)
    const eastern = new Date(now.getTime() - (dst ? 4 : 5) * 3600000)
    const day = eastern.getUTCDay()
    const monday = Date.UTC(eastern.getUTCFullYear(), eastern.getUTCMonth(), eastern.getUTCDate() + ((8 - day) % 7 || 7))
    const keys = [0, 1, 2, 3, 4].map(i => new Date(monday + i * 86400000).toISOString().slice(0, 10))
    return { day, keys }
  }
}
