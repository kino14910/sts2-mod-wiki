# 构建产物导入

导入器读取实际发布的 DLL、PCK 和同名 JSON 清单。源码只用于审查和交叉验证，不参与生产导入，也不执行 Mod 程序集。

## 数据边界

| 层 | 位置 | 职责 |
| --- | --- | --- |
| 原始产物 | `--build` 指定的外部目录 | 原始 DLL/PCK/JSON，只读 |
| 提取证据 | `.cache/mod-import/{mod}/{fingerprint}/` | PCK 索引、反编译 C#、诊断、标准化快照 |
| 标准化数据 | `generated/mods/{mod}/bundle.json` | 实体、变量、升级、关联、本地化、资源引用和来源哈希 |
| 历史快照 | `generated/mods/{mod}/snapshots/` | 保留每次成功导入，便于比较或恢复 |
| Web 资源 | `static/imported/{mod}/{fingerprint}/images/` | 从 PCK 解码的图片，按内容输入版本隔离 |
| 展示配置 | `content/mods/{mod}.json` | 程序集名、PCK 根路径、Wiki 配色与卡池展示 |
| Wiki 正文 | 内容模块 / D1 Wiki 章节与版本 | 编辑、审核、历史与来源同步，不由游戏数据导入器覆盖 |

`virtual:mods` 在构建时消费标准化 bundle。兼容现有公共实体 ID 的逻辑文件键不代表实际读取 `static/mods/{mod}`；已配置构建导入的 Mod 会完全跳过该手工目录。原版游戏的现有离线数据仍由独立适配器读取，未假称本次重建了完整原版数据集。

## 运行

需要 Python 3.11+、Pillow、.NET 和 `ilspycmd`。运行环境已装有这些工具。其他机器可安装：

```sh
python -m pip install -r scripts/mod-extract/requirements.txt
dotnet tool install --global ilspycmd --version 11.0.0.9375
pnpm mod:import --mod fgo --build "D:/Steam/steamapps/common/Slay the Spire 2/mods/Fgo"
pnpm check
pnpm test:import
pnpm test:unit --run
pnpm test:e2e
pnpm build
```

默认引用游戏 `data_sts2_windows_x86_64`。RitsuLib 分版本安装会按构建清单的 API 版本（或唯一兼容版本）选择 `compat/{version}`，同时加载 `shared`。根目录的 DLL 只是加载器，不能替代实际运行时依赖。可重复传入 `--reference <directory>` 覆盖。继承的游戏本地化来自实际 `SlayTheSpire2.pck`，可用 `--game-pack` 指定；其哈希也参与指纹。缺少依赖或版本选择不唯一时明确失败。`--ilspy` 可指定工具路径，`--force` 可强制重新解析。

新增 Mod 需要对应的解析配置 `scripts/mod-extract/mods/{id}.json` 以及展示配置 `content/mods/{id}.json`。这些声明描述命名规则、支持的枚举和展示选择，不复制手写卡牌数值。

### FGO 卡池展示配置

`content/mods/fgo.json` 的 `display.cardPool` 必须同时声明 `fgo` 和 `noble`。卡池由 DLL 提取，展示配置负责图标、语言标签和 Wiki 配色；导入时不会合并旧 `static/mods/fgo/manifest.json`，也不会读取手工卡牌 JSON。迁移时遗漏 `noble` 会使前端无法识别已正确导出的宝具池。

保留旧清单的展示语义：普通池 `accent=#a6a199`、`energyOutline=#5c5440`，使用 attack/skill/power 三种自定义卡框；宝具池 `accent=#ffd700`、`energyOutline=#be6900`，显式保留 `cardFrame: {}`，表示不使用普通池自定义卡框。普通池的 Wiki 配色是展示选择，不用角色 `NameColor` 或新版游戏池颜色覆盖。标签分别为 `eng=Fgo/zhs=御主` 与 `eng=Noble Phantasm/zhs=宝具`。

`cardPool[poolId].labels` 按游戏 locale（例如 `eng`、`zhs`）映射展示名称，用于筛选按钮标题、无障碍名称与卡牌归属文字；优先读取当前语言，其次 `eng`，最后使用原有名称回退。迁移展示配置时须保留这组标签，不能只迁移图片与颜色。

`cardFrame` 的三种声明具有不同含义：未声明时使用默认卡框；显式 `{}` 时不渲染卡框；仅声明部分类型时，已声明类型使用自定义卡框，其余类型回退默认卡框。迁移时须原样保留字段是否存在、空对象和各类型映射，不能把它们统一处理为“没有配置”。

2026-11-13 核对实际发布产物：`Fgo.dll` SHA-256 为 `9b4859d66aca6eef15d935d6b811fa6e2c2a4002ca306f3c0dc3eb899bd83fe6`，`Fgo.pck` 为 `a7a6006d4b0f77783601edb56a4f89340b06a949f78eb4d50963779fc84f7f7d`。反编译的 `NobleCardModel` 具有 `[RegisterCard(typeof(NobleCardPool), Inherit = true)]` 与 `Pool => ModelDb.CardPool<NobleCardPool>()`，`NobleCardPool.EnergyColorName => "noble"` 且 `IsColorless => false`。现有解析器已导出 46 张 `pool=noble`、`poolRef=NobleCardPool` 的卡牌，无需新增 `color` 字段或修改池分类逻辑；回归测试保留这些实际声明。

PCK 通过 `.import` 指向 `.ctex`，对应导入路径为 `images/charui/character_icon_{fgo,noble}.png`、`images/ui/energy_{fgo,noble}_big.png`、共享的 `images/ui/energy_fgo.png` 和 `images/card_frames/card_frame_{attack,skill,power}.png`。`localization/zhs/characters.json` 的 `FGO_CHARACTER_FGO_CHARACTER.title` 为“御主”；`localization/{eng,zhs}/gameplay_ui.json` 的 `FGO_GAMEPLAY_UI_POOL_NOBLE` 分别为“Noble Phantasm”和“宝具”。所有配置图片须存在于本次 PCK 提取结果，再转换为当前指纹下的 `/imported/...` URL；转换须保留 labels、配色和空卡框对象。

## 校验与增量

指纹包含原始产物、游戏 PCK、引用程序集、解析器代码、Node 校验合同及其依赖、工具版本及配置的 SHA-256。输入相同且当前校验器确认 bundle 与资源完整时跳过；输入变化时生成新快照。Node 是 JSON 摘要的唯一实现，拒绝不安全整数与非有限数值。发布前再次核对输入，处理中发生变化则失败，不替换当前已发布 bundle，也不更新 D1。Python 发布前调用站点共享的 TypeScript 字段校验器；构建再次核验配置、摘要和磁盘资源，禁止损坏或过期内容静默进入站点。

PCK 读取器支持独立 Godot v2/v3 包，校验边界、路径、重复条目及读取文件的 MD5。加密、稀疏包、删除条目和未支持的纹理编码明确失败。当前 FGO 使用的 `CompressedTexture2D` WebP 数据按 Godot 格式解析首个 mip，再输出 PNG；同名 PNG/WebP 源保留为不同输出，不覆盖。

每次解析使用独立临时资源树，通过校验后才发布资源并切换 bundle 指针。同一指纹的健康资源不重写；修复损坏资源前要求与已发布快照内容一致，发布失败会恢复原有字节。`.publish.lock` 防止两个进程同时发布；异常中止留下锁时，先确认没有导入进程运行，再移除该锁后重试。

C# 提取是静态分析。运行时战斗状态、随机结果及无法静态求值的表达式不能伪装成已验证常量。请查看每次的 `diagnostics.json`；新增语法应先添加真实反编译样例测试，再扩展解析器。游戏描述保持原始模板，变量保持原始数值，例如倍率 `1.25`，由共享文本求值层负责显示。

完整模型保存在 `catalog`，可显示模型保存在 `data`。缺少真实基础语言文本的模型进入 `quarantined`，不会伪造译文或丢弃原始声明。`sourceLocalization` 保留 PCK 原表；继承的标题/描述由代码中的 `localizationRefs` 决定，规范化投影与原表独立。外部模型关系对照实际游戏 DLL 的类型表验证，资源通过 `.import`/`.remap` 追踪。运行时投影不携带反编译正文、诊断或所有来源证据，减少客户端下载量。

2026-11-13 本地实测 FGO：171 张卡牌、12 遗物、4 药水、69 能力模型、1 角色；426 图片和 171 缩略图。`DefDownPower`、`PeerlessStrikePower` 缺翻译，隐藏模型 `ImaginarySpacePower` 也无对应翻译；三者完整保留但不公开到实体列表。47 个运行时费用覆盖与 17 个计算变量保留表达式，展示静态基础值，不能等同于战斗模拟。3 个自定义关键词保留关系引用。

`maxUpgradeLevel`、`upgradeLevels` 和 `upgradeMetadata` 保存多级升级和验证状态；`upgrade` 保持首次升级投影供当前基础/升级切换使用。当前 DLL 共 310 个已验证升级级别，其中 47 张卡可升四级。按语句顺序执行明确的变量/费用变化与 `base.OnUpgrade()`，未知控制流使导入失败。`FifthForce` 对现有战斗 power 的修改另存 runtime effect，不重复计入卡牌变量。`refs` 的 `relationKind=declaration-reference` 与来源表示声明引用，包含继承类，不能直接解释为“这张卡施加该能力”。

## 内容安全与回退

原有 `static/mods` 文件没有被删除。导入器不写社区数据库、不重新生成已应用迁移、不清空评论或修订历史。恢复某个导入版本时，先核实对应 `snapshots/{fingerprint}.json` 与资源完整，再将其作为当前 bundle；社区记录不随游戏数据回退。

`pnpm mod:extract-source` 只保留为开发交叉验证工具。站点不把它的 FGO 输出作为构建产物导入后的事实来源。
