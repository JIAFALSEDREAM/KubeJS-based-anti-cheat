// 基于KubeJS的反作弊脚本 -by JIAFALSEDREAM
// https://github.com/JIAFALSEDREAM/KubeJS-based-anti-cheat
// 目前已经实现的功能： 非法药水等级检测， 非法物品和方块检测， 非法附魔等级检测， 非法属性检测
// 未实现功能： 掉落物检测（其实马上就可以写但是我懒得动）
// 有权限等级4的玩家（op）不会触发反作弊
// 使用方法：丢服务器的kubejs\server_scripts\文件夹下面，可以套别的文件夹（服务器没kubejs就下个装上）

/**
 * 反作弊配置
 */
const AntiCheatConfig = {
  // 如何处理触发了反作弊的玩家
  // 可以设置为 "ban", "clear_and_ban", "spectator_mode" 或 "clear_and_spectator_mode"
  punishmentType: "spectator_mode",

  // 聊天栏关键词（发送时会显示作弊玩家名单）
  cheatListKeyword: "cheater list",

  // 黑名单物品ID列表
  bannedItems: [
    //机械动力
    "create:creative_motor",
    "create:creative_crate",
    "create:creative_fluid_tank",
    "create:handheld_worldshaper",
    "create:creative_blaze_cake",
    //机械动力：CC&A
    "createaddition:creative_energy",
    //机械动力：物品附加
    "create_sa:creative_filling_tank",
    //机械动力：创意传动
    "create_connected:creative_fluid_vessel",
    //机械动力：火炮
    "createbigcannons:creative_autocannon_ammo_container",
    //ClockWork
    "vs_clockwork:creative_gravitron",
    //mek
    "mekanism:creative_bin",
    "mekanism:creative_fluid_tank",
    "mekanism:creative_energy_cube",
    "mekanism:creative_chemical_tank",
    //ae2
    "ae2:creative_energy_cell",
    "ae2:creative_fluid_cell",
    //CC电脑
    "computercraft:computer_command",
    //功能性存储
    "functionalstorage:creative_vending_upgrade",
    //原版管理员用品
    "minecraft:command_block_minecart",
    "minecraft:structure_void",
    "minecraft:barrier",
    "minecraft:light",
  ],

  // 蓝图物品ID
  schematicItem: "create:schematic",

  // 遥控器讲台物品ID
  lecternController: "create:lectern_controller",

  // 最大允许附魔等级
  maxEnchantmentLevel: 20,

  // 最大允许属性值
  maxAttributeValue: 100,

  // 药水效果允许范围
  potionEffectRange: { min: 0, max: 100 },
};

//以下为功能执行部分，非必要勿动！！！

PlayerEvents.inventoryChanged((event) => {
  const { item, player, server } = event;

  /**@type {Internal.ServerPlayer_}*/
  const serverPlayer = player;

  // 触发者id和次数存储
  function updateCheaterTag(playerName) {
    server.persistentData.CheaterTag = server.persistentData.CheaterTag || {};

    if (!Array.isArray(server.persistentData.CheaterTag.id)) {
      server.persistentData.CheaterTag.id = [];
    }

    let existingItem = server.persistentData.CheaterTag.id.find(function (item) {
      return item.name === playerName;
    });

    if (existingItem) {
      existingItem.count += 1;
    } else {
      let newItem = { name: playerName, count: 1 };
      server.persistentData.CheaterTag.id.push(newItem);
    }
  }

  // 制裁
  function handleIllegalItem(player, item, server, reason) {
    updateCheaterTag(player.name.string);
    switch (AntiCheatConfig.punishmentType) {
      case "ban":
        server.runCommand(`ban ${player.name.string} §c持有${reason}\n物品ID：${item.id}`);
        break;
      case "clear_and_ban":
        player.inventory.clear();
        server.runCommand(`ban ${player.name.string} §c持有${reason}\n物品ID：${item.id}`);
        break;
      case "spectator_mode":
        serverPlayer.setGameMode("spectator");
        break;
      case "clear_and_spectator_mode":
        player.inventory.clear();
        serverPlayer.setGameMode("spectator");
        break;
      default:
        // 无法识别会使用默认
        // 我朝怎么有笨比还能填错的
        player.inventory.clear();
        serverPlayer.setGameMode("spectator");
        break;
    }
    server.tell(
      `§a检测到玩家 §6${player.name.string} \n§c持有${reason}\n物品ID：${item.id}\n§a已处理：${AntiCheatConfig.punishmentType}\n§7玩家信息已被存储\n请通知管理员进行处理`
    );
  }

  if (!player.hasPermissions(4)) {
    // 检查非法附魔和非法物品
    if (AntiCheatConfig.bannedItems.includes(item.id)) {
      handleIllegalItem(player, item, server, "§c非法物品");
    } else if (item.enchantmentTags) {
      item.enchantmentTags.forEach((ench) => {
        if (ench.lvl > AntiCheatConfig.maxEnchantmentLevel) {
          handleIllegalItem(
            player,
            item,
            server,
            `§c非法附魔物品\n附魔ID：${ench.id}\n附魔等级：${ench.lvl}`
          );
        }
      });
    }

    // 检查异常属性
    if (item.nbt?.tags?.AttributeModifiers?.some) {
      if (
        item.nbt.tags.AttributeModifiers.some(
          (modifier) => modifier.Amount > AntiCheatConfig.maxAttributeValue
        )
      ) {
        handleIllegalItem(player, item, server, "§c异常属性物品");
      }
    }

    // 检查异常药水等级
    if (item.nbt?.tags?.CustomPotionEffects?.some) {
      if (
        item.nbt.tags.CustomPotionEffects.some(
          (PotionEffects) =>
            PotionEffects.Amplifier < AntiCheatConfig.potionEffectRange.min ||
            PotionEffects.Amplifier > AntiCheatConfig.potionEffectRange.max
        )
      ) {
        handleIllegalItem(player, item, server, "§c异常药水等级物品");
      }
    }

    // 检查蓝图,禁用遥控器讲台
    if (item.getId() == AntiCheatConfig.schematicItem) {
      let path = "./schematics/uploaded/" + item.nbt?.Owner + "/" + item.nbt?.File;
      let nbt = NBTIO.read(path);
      let blocks = nbt.get("blocks");
      blocks.forEach((tag) => {
        if (tag.get("nbt").get("id") == AntiCheatConfig.lecternController) {
          handleIllegalItem(player, item, server, "§遥控器讲台");
          return;
        }
      });
    }
  }
});

// 主动查询（聊天栏发送关键词）
PlayerEvents.chat((event) => {
  const { player, message, server } = event;

  if (message.trim().toLowerCase() === AntiCheatConfig.cheatListKeyword) {
    if (server.persistentData.CheaterTag && Array.isArray(server.persistentData.CheaterTag.id)) {
      let showMessage =
        "\n（列表中的玩家已被反作弊脚本处理 处理方式见反作弊脚本相关设置）\n§4反作弊触发玩家:§r\n";
      server.persistentData.CheaterTag.id.forEach((item) => {
        showMessage += `玩家id: ${item.name} - 触发次数: ${item.count}\n`;
      });
      server.tell(showMessage);
    } else {
      server.tell("§4已触发反作弊玩家§6名单为空");
    }
  }
});

// 权限玩家进入发送消息
// PlayerEvents.loggedIn((event) => {
//   const { item, player, server, slot } = event;
//   if (player.hasPermissions(4)) {
//     if (server.persistentData.CheaterTag && Array.isArray(server.persistentData.CheaterTag.id)) {
//       let showMessage =
//         "\n§6检测到权限等级为4的玩家进入\n自动发送§4已触发反作弊玩家§6名单§r\n （列表中的玩家已被反作弊脚本处理 处理方式见反作弊脚本相关设置）\n\n§4触发玩家列表:§r\n";
//       server.persistentData.CheaterTag.id.forEach((item) => {
//         showMessage += `玩家id: ${item.name} - 触发次数: ${item.count}\n`;
//       });
//       server.tell(showMessage);
//     } else {
//       server.tell("§4已触发反作弊玩家§6名单为空");
//     }
//   }
// });
