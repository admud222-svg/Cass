async function ForceOpen(player, form) {
  let res = await form.show(player)
  while (res.cancelationReason === "UserBusy") res = await form.show(player)
  return res
}
export { ForceOpen };