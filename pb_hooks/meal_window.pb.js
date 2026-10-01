// Enforces the parent ordering window server-side.
// Parents may only create/change meal selections Thursday 00:00 -> Friday 23:59
// (local server time), and only for the upcoming week's Monday through Friday.
// Admins bypass this entirely.

onRecordCreateRequest((e) => {
  const auth = e.auth
  if (auth && auth.getString("role") !== "admin") {
    const now = new Date()
    const dow = now.getDay() // 0 Sun ... 6 Sat
    if (dow !== 4 && dow !== 5) {
      throw new BadRequestError("Ordering is only open Thursday and Friday for the upcoming week.")
    }
    const pad = (n) => (n < 10 ? "0" + n : "" + n)
    const fmt = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    const daysUntilMon = (8 - dow) % 7 // Thu -> 4, Fri -> 3
    const mon = new Date(now); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() + daysUntilMon)
    const allowed = [0, 1, 2, 3, 4].map((i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return fmt(d) })
    const ld = e.record.getString("lunch_date")
    const key = ld ? ld.substring(0, 10) : ""
    if (allowed.indexOf(key) === -1) {
      throw new BadRequestError("Parents can only order for the upcoming Monday through Friday.")
    }
  }
  e.next()
}, "meal_selections")

onRecordUpdateRequest((e) => {
  const auth = e.auth
  if (auth && auth.getString("role") !== "admin") {
    const now = new Date()
    const dow = now.getDay()
    if (dow !== 4 && dow !== 5) {
      throw new BadRequestError("Ordering is only open Thursday and Friday for the upcoming week.")
    }
    const pad = (n) => (n < 10 ? "0" + n : "" + n)
    const fmt = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    const daysUntilMon = (8 - dow) % 7
    const mon = new Date(now); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() + daysUntilMon)
    const allowed = [0, 1, 2, 3, 4].map((i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return fmt(d) })
    const ld = e.record.getString("lunch_date")
    const key = ld ? ld.substring(0, 10) : ""
    if (allowed.indexOf(key) === -1) {
      throw new BadRequestError("Parents can only order for the upcoming Monday through Friday.")
    }
  }
  e.next()
}, "meal_selections")
