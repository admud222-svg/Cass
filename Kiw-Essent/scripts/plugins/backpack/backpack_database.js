import { world, system } from "@minecraft/server"

const PLAYER_PREFIX = "bp_player_"
const PLAYERS_LIST_KEY = "bp_players_list"
const DB_VERSION = 1
const MAX_CHUNK_SIZE = 32000

class BackpackDatabase extends Map {
  constructor(autoSaveInterval = 30, prefix = PLAYER_PREFIX) {
    super()
    this.id = prefix
    this.autoSaveInterval = autoSaveInterval
    this.saveTimer = null
    this.isInitialized = false
    this.init()
    if (autoSaveInterval > 0) this.startAutoSave()
  }

  init() {
    system.runTimeout(() => {
      const version = world.getDynamicProperty("bp_version")
      if (!version) {
        world.setDynamicProperty("bp_version", DB_VERSION.toString())
        world.setDynamicProperty(PLAYERS_LIST_KEY, JSON.stringify([]))
        const oldBackpacks = world.getDynamicProperty("player_backpacks")
        if (oldBackpacks) this.migrateFromOldFormat(oldBackpacks)
      }
      this.loadAll()
      this.isInitialized = true
    }, 20)
  }

  loadAll() {
    const listStr = world.getDynamicProperty(PLAYERS_LIST_KEY)
    const list = listStr ? JSON.parse(listStr) : []
    for (const player of list) {
      const items = this._loadPlayer(player)
      super.set(player, items)
    }
  }

  _loadPlayer(player) {
    const chunkInfoStr = world.getDynamicProperty(this.id + player + "_info")
    if (chunkInfoStr) {
      const chunkInfo = JSON.parse(chunkInfoStr)
      if (chunkInfo.isChunked) {
        let combined = ""
        for (let i = 0; i < chunkInfo.count; i++) {
          const chunk = world.getDynamicProperty(this.id + player + "_chunk_" + i)
          if (!chunk) return []
          combined += chunk
        }
        return JSON.parse(combined)
      }
    }
    const data = world.getDynamicProperty(this.id + player)
    return data ? JSON.parse(data) : []
  }

  set(player, items) {
    if (!player || !Array.isArray(items)) return
    const formatted = items.map(item => ({
      typeId: item.typeId || "minecraft:air",
      amount: Number(item.amount) || 1,
      data: item.data || 0,
      durability: item.durability || null,
      enchantments: item.enchantments || [],
      name: item.name || "",
      lore: item.lore || [],
    }))
    super.set(player, formatted)
    this._savePlayer(player, formatted)
    this._addPlayerToList(player)
  }

  get(player) {
    return super.has(player) ? super.get(player) : this._loadPlayer(player)
  }

  delete(player) {
    super.delete(player)
    this._removePlayerFromList(player)
    this._clearPlayerData(player)
  }

  _savePlayer(player, items) {
    const serialized = JSON.stringify(items)
    if (serialized.length > MAX_CHUNK_SIZE) {
      const chunks = []
      for (let i = 0; i < serialized.length; i += MAX_CHUNK_SIZE) {
        chunks.push(serialized.slice(i, i + MAX_CHUNK_SIZE))
      }
      world.setDynamicProperty(this.id + player + "_info", JSON.stringify({ isChunked: true, count: chunks.length }))
      for (let i = 0; i < chunks.length; i++) {
        world.setDynamicProperty(this.id + player + "_chunk_" + i, chunks[i])
      }
      world.setDynamicProperty(this.id + player, null)
    } else {
      world.setDynamicProperty(this.id + player, serialized)
      world.setDynamicProperty(this.id + player + "_info", null)
    }
  }

  _clearPlayerData(player) {
    const chunkInfoStr = world.getDynamicProperty(this.id + player + "_info")
    if (chunkInfoStr) {
      const chunkInfo = JSON.parse(chunkInfoStr)
      if (chunkInfo.isChunked) {
        for (let i = 0; i < chunkInfo.count; i++) {
          world.setDynamicProperty(this.id + player + "_chunk_" + i, null)
        }
        world.setDynamicProperty(this.id + player + "_info", null)
      }
    }
    world.setDynamicProperty(this.id + player, null)
  }

  _addPlayerToList(player) {
    const listStr = world.getDynamicProperty(PLAYERS_LIST_KEY)
    const list = listStr ? JSON.parse(listStr) : []
    if (!list.includes(player)) {
      list.push(player)
      world.setDynamicProperty(PLAYERS_LIST_KEY, JSON.stringify(list))
    }
  }

  _removePlayerFromList(player) {
    const listStr = world.getDynamicProperty(PLAYERS_LIST_KEY)
    if (listStr) {
      const list = JSON.parse(listStr)
      const idx = list.indexOf(player)
      if (idx !== -1) {
        list.splice(idx, 1)
        world.setDynamicProperty(PLAYERS_LIST_KEY, JSON.stringify(list))
      }
    }
  }

  migrateFromOldFormat(oldBackpacksData) {
    try {
      const oldBackpacks = JSON.parse(oldBackpacksData)
      if (!oldBackpacks || typeof oldBackpacks !== "object") return
      const playersList = []
      for (const player in oldBackpacks) {
        const items = oldBackpacks[player]
        if (!Array.isArray(items)) continue
        const converted = items.map(item => ({
          typeId: item.typeId || item.id || "minecraft:air",
          amount: item.amount || item.count || 1,
          data: item.data || 0,
          durability: item.durability || null,
        }))
        this.set(player, converted)
        playersList.push(player)
      }
      world.setDynamicProperty(PLAYERS_LIST_KEY, JSON.stringify(playersList))
      world.setDynamicProperty("player_backpacks", null)
    } catch { }
  }

  startAutoSave() {
    if (this.saveTimer) system.clearRun(this.saveTimer)
    this.saveTimer = system.runInterval(() => {
      for (const [player, items] of this) this._savePlayer(player, items)
    }, this.autoSaveInterval * 20)
  }

  stopAutoSave() {
    if (this.saveTimer) {
      system.clearRun(this.saveTimer)
      this.saveTimer = null
    }
  }
}

export { BackpackDatabase }
