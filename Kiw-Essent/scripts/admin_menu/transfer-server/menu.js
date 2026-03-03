import { ActionFormData, ModalFormData, world, system } from "../../core.js";
import { transferPlayer } from "@minecraft/server-admin";

const DEFAULT_PORT = 19132;

function getServerList() {
  try {
    const serverListStr = world.getDynamicProperty("servers");
    if (!serverListStr) {
      const defaultList = {
        lobby: {
          name: "Lobby Server",
          host: "localhost",
          port: 19132,
          description: "Main lobby server",
        },
      };
      saveServerList(defaultList);
      return defaultList;
    }
    return JSON.parse(serverListStr);
  } catch (error) {
    console.warn("Error getting servers:", error);
    return {
      lobby: {
        name: "Lobby Server",
        host: "localhost",
        port: 19132,
        description: "Main lobby server",
      },
    };
  }
}

function saveServerList(servers) {
  try {
    world.setDynamicProperty("servers", JSON.stringify(servers));
  } catch (error) {
    console.warn("Failed to save server list:", error);
  }
}

function isAdmin(player) {
  return player.hasTag("admin");
}

export function showServerMenu(player) {
  if (isAdmin(player)) {
    showAdminMenu(player);
  } else {
    showPlayerMenu(player);
  }
}

function showPlayerMenu(player) {
  const menu = new ActionFormData()
    .title("Server Transfer Menu")
    .body("Select a server to connect to");

  const servers = getServerList();
  Object.values(servers).forEach((server) => {
    menu.button(
      `${server.name}\n§7${server.description}`,
      "textures/ui/world_glyph_color_2x",
    );
  });

  menu.show(player).then((response) => {
    if (response.canceled) return;
    const server = Object.values(servers)[response.selection];
    transferToServer(player, server.host, server.port);
  });
}

export function showAdminMenu(player) {
  const menu = new ActionFormData()
    .title("§cAdmin Server Manager")
    .body("Manage servers or connect to one")
    .button(
      "§2Connect to Server\n§7Join a server",
      "textures/ui/world_glyph_color_2x",
    )
    .button(
      "§6Add New Server\n§7Create a new server entry",
      "textures/ui/icon_recipe_construction",
    )
    .button(
      "§cEdit Server\n§7Modify existing server",
      "textures/ui/icon_setting",
    )
    .button("§4Delete Server\n§7Remove a server", "textures/ui/icon_trash");

  menu.show(player).then((response) => {
    if (response.canceled) return;

    switch (response.selection) {
      case 0:
        showServerList(player);
        break;
      case 1:
        showAddServerForm(player);
        break;
      case 2:
        showEditServerSelect(player);
        break;
      case 3:
        showDeleteServerSelect(player);
        break;
    }
  });
}

export function showServerList(player) {
  const menu = new ActionFormData()
    .title("Available Servers")
    .body("Select a server to connect to");

  const servers = getServerList();
  Object.values(servers).forEach((server) => {
    if (isAdmin(player)) {
      menu.button(
        `${server.name}\n§7${server.host}:${server.port}\n§8${server.description}`,
        "textures/ui/world_glyph_color_2x",
      );
    } else {
      menu.button(
        `${server.name}\n§8${server.description}`,
        "textures/ui/world_glyph_color_2x",
      );
    }
  });

  menu.show(player).then((response) => {
    if (response.canceled) {
      if (isAdmin(player)) showAdminMenu(player);
      return;
    }
    const server = Object.values(servers)[response.selection];
    transferToServer(player, server.host, server.port);
  });
}

function showAddServerForm(player) {
  const form = new ModalFormData()
    .title("Add New Server")
    .textField("Server ID (no spaces):", "Example: survival, minigame1", {
      defaultValue: "server1",
    })
    .textField("Display Name:", "Example: Survival Server, Mini Games", {
      defaultValue: "New Server",
    })
    .textField("Host Address:", "Example: play.example.com or 192.168.1.1", {
      defaultValue: "localhost",
    })
    .textField("Port:", "Default: 19132", { defaultValue: "19132" })
    .textField("Description:", "Example: Main survival server with economy", {
      defaultValue: "A Minecraft Bedrock server",
    });

  form.show(player).then((response) => {
    if (response.canceled) {
      showAdminMenu(player);
      return;
    }

    const [id, name, host, portStr, description] = response.formValues;
    const port = parseInt(portStr) || DEFAULT_PORT;

    if (!id || !name || !host) {
      player.sendMessage("§cAll fields except description are required!");
      return;
    }

    if (!isValidIP(host)) {
      player.sendMessage("§cInvalid server address format!");
      return;
    }

    const servers = getServerList();
    if (servers[id]) {
      player.sendMessage("§cServer ID already exists!");
      return;
    }

    servers[id] = { name, host, port, description };
    saveServerList(servers);
    player.sendMessage("§aServer added successfully!");
    player.runCommand(`playsound random.levelup @s`);
    showAdminMenu(player);
  });
}

function showEditServerSelect(player) {
  const menu = new ActionFormData()
    .title("Edit Server")
    .body("Select a server to edit");

  const servers = getServerList();
  Object.values(servers).forEach((server) => {
    menu.button(
      `${server.name}\n§7${server.host}:${server.port}`,
      "textures/ui/world_glyph_color_2x",
    );
  });

  menu.show(player).then((response) => {
    if (response.canceled) {
      showAdminMenu(player);
      return;
    }

    const serverId = Object.keys(servers)[response.selection];
    const server = servers[serverId];
    showEditServerForm(player, serverId, server);
  });
}

function showEditServerForm(player, serverId, server) {
  const form = new ModalFormData()
    .title(`Edit Server: ${server.name}`)
    .textField("Display Name:", "Example: Survival Server, Mini Games", {
      defaultValue: server.name,
    })
    .textField("Host Address:", "Example: play.example.com or 192.168.1.1", {
      defaultValue: server.host,
    })
    .textField("Port:", "Default: 19132", {
      defaultValue: server.port.toString(),
    })
    .textField("Description:", "Example: Main survival server with economy", {
      defaultValue: server.description || "A Minecraft Bedrock server",
    });

  form.show(player).then((response) => {
    if (response.canceled) {
      showEditServerSelect(player);
      return;
    }

    const [name, host, portStr, description] = response.formValues;
    const port = parseInt(portStr) || DEFAULT_PORT;

    if (!name || !host) {
      player.sendMessage("§cName and host are required!");
      return;
    }

    if (!isValidIP(host)) {
      player.sendMessage("§cInvalid server address format!");
      return;
    }

    const servers = getServerList();
    servers[serverId] = { name, host, port, description };
    saveServerList(servers);
    player.sendMessage("§aServer updated successfully!");
    player.runCommand(`playsound random.levelup @s`);
    showAdminMenu(player);
  });
}

function showDeleteServerSelect(player) {
  const menu = new ActionFormData()
    .title("§4Delete Server")
    .body("§cSelect a server to delete. This cannot be undone!");

  const servers = getServerList();
  Object.values(servers).forEach((server) => {
    menu.button(
      `§4${server.name}\n§7${server.host}:${server.port}`,
      "textures/ui/world_glyph_color_2x",
    );
  });

  menu.show(player).then((response) => {
    if (response.canceled) {
      showAdminMenu(player);
      return;
    }

    const serverId = Object.keys(servers)[response.selection];
    delete servers[serverId];
    saveServerList(servers);
    player.sendMessage("§aServer deleted successfully!");
    player.runCommand(`playsound random.break @s`);
    showAdminMenu(player);
  });
}

function transferToServer(player, host, port) {
  try {
    player.sendMessage(`§aConnecting to ${host}:${port}...`);
    system.run(() => {
      try {
        transferPlayer(player, {
          hostname: host,
          port: port,
        });
      } catch (error) {
        player.sendMessage("§cConnection failed: " + error.message);
        console.error("Transfer error:", error);
      }
    });
  } catch (error) {
    player.sendMessage("§cConnection failed: " + error.message);
    console.error("Transfer error:", error);
  }
}

function isValidIP(ip) {
  return ip.length > 0 && ip.length <= 255 && /^[a-zA-Z0-9.-]+$/.test(ip);
}
