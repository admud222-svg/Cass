import { world, system } from "@minecraft/server"
import { ScoreboardDB } from "../../board/data.js"
export class RankDatabase {
  static getPlayerRank(player) {
    const tag = player.getTags().find(t => t.startsWith("rank:"))
    return tag || null
  }
  static setPlayerRank(player, rank) {
    const currentRank = this.getPlayerRank(player)
    if (currentRank) player.removeTag(currentRank)
    if (rank) player.addTag(rank)
    ScoreboardDB?.set(`player_rank_${player.name}`, rank || "")
  }
  static loadPlayerRank(player) {
    const savedRank = ScoreboardDB?.get(`player_rank_${player.name}`)
    if (savedRank) {
      const currentRank = this.getPlayerRank(player)
      if (currentRank !== savedRank) {
        if (currentRank) player.removeTag(currentRank)
        player.addTag(savedRank)
      }
    }
  }
  static getAllPlayersWithRank(rank) {
    return world.getAllPlayers().filter(p => p.hasTag(rank))
  }
  static saveCustomRankList(rankList) {
    system.run(() => {
      world.setDynamicProperty("customRankList", JSON.stringify(rankList))
    })
  }
  static loadCustomRankList(callback) {
    system.run(() => {
      const data = world.getDynamicProperty("customRankList")
      const list = data ? JSON.parse(data) : []
      callback(list)
    })
  }
  static saveDefaultRank(rank) {
    system.run(() => {
      world.setDynamicProperty("defaultRank", rank)
    })
  }
  static loadDefaultRank() {
    try {
      const saved = world.getDynamicProperty("defaultRank")
      return saved || ""
    } catch (e) {
      return ""
    }
  }
}
