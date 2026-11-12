# 模组清单与本地化 Key

`static/mods/{modid}/manifest.json` 注册一个模组。本文档说明清单里的前置依赖声明，以及卡牌 / Buff 的本地化 Key 如何自动生成。

## 前置依赖

```json
{
	"id": "fgo",
	"name": "Fate/Grand Order",
	"author": "...",
	"blurb": "...",
	"accent": "#c65a42",
	"dependency": { "type": "ritsulib", "modid": "FGO" },
	"cards": "cards.json",
	"powers": "powers.json",
	"relics": "relics.json",
	"potions": "potions.json"
}
```

`dependency` 是单个对象，避免同一模组出现多套互相冲突的 ID 规则。声明了 `cards`、`powers`、`relics` 或 `potions` 的模组必须提供 `dependency`。

| 类型 | 必填字段 | 可选字段 | 说明 |
| --- | --- | --- | --- |
| `baselib` | `namespace` | - | 命名空间必须是非空的 C# 命名空间（如 `Test.Scripts`），前缀取首段 |
| `ritsulib` | `modid` | - | 内容类别由加载层按卡牌 / Buff 自动传入，清单中不允许声明 |
| `other` | - | `prefix` | 开发者自行填写前缀，允许为空（默认空） |

校验规则：

- 每种类型只允许上表中的字段，出现 `namespace` / `modid` / `prefix` 混用或 `category`、`modelType` 等冗余字段会被判定为无效清单。
- `other.prefix` 仅允许 `A-Z`、`a-z`、`0-9`、`_`，可以有空字符串。
- `baselib.namespace` 与 `ritsulib.modid` 的 Entry ID 完全由 `src/lib/data/entry-id.ts` 生成；该模块与 `tools/id-generator` 使用同一套算法，开发者不需要手写 ID 或完整 Key。

## 本地化 Key 规则

Key = `EntryID.字段`，卡牌、Buff、遗物与药水只读取两个字段：

- `.title`
- `.description`

| 前置类型 | 声明示例 | 卡牌 `Strike` | Buff `FifthForcePower` |
| --- | --- | --- | --- |
| `baselib` | `namespace: "Test.Scripts"` | `TEST-STRIKE.title` | `TEST-FIFTH_FORCE_POWER.title` |
| `ritsulib` | `modid: "FGO"` | `FGO_CARD_STRIKE.title` | `FGO_POWER_FIFTH_FORCE_POWER.title` |
| `other` | `prefix: ""` | `STRIKE.title` | `FIFTH_FORCE_POWER.title` |
| `other` | `prefix: "MYMOD_"` | `MYMOD_STRIKE.title` | `MYMOD_FIFTH_FORCE_POWER.title` |

内容数据中的 `id` 使用类名 / Entry 名（如 `StrikeIronclad`、`DemonForm`、`FifthForcePower`），不要写完整 Key。加载层会按前置类型和内容类别（`card`、`power`、`relic`、`potion`）自动拼接。

RitsuLib 模组的遗物与药水分别使用 `relic` / `potion` 作为类别段，例如 `FGO_RELIC_AKABEKO.title`、`FGO_POTION_BLOCK_POTION.title`。

## 本地化文件

模组本地化放在：

```
static/mods/{modid}/localization/{locale}/*.json
```

每个 JSON 都是扁平的 `Key: 文本`，同一 locale 目录下的所有文件会被合并。重复 Key 会在控制台警告，后读取的文件覆盖先读取的文件。

示例 `static/mods/fgo/localization/eng/cards.json`：

```json
{
	"FGO_CARD_STRIKE.title": "Strike",
	"FGO_CARD_STRIKE.description": "Deal {Damage:diff()} damage."
}
```

示例 `static/mods/fgo/localization/eng/powers.json`：

```json
{
	"FGO_POWER_FIFTH_FORCE_POWER.title": "Fifth Force",
	"FGO_POWER_FIFTH_FORCE_POWER.description": "Gain {Amount} [gold]Strength[/gold]."
}
```

缺少基础语言（`eng`）的 `.title` 或 `.description` 时，卡牌 / Buff 会被跳过并在控制台输出缺失的 Key；其他语言缺失时回退到基础语言。

## 内容数据

`cards.json` 与 `powers.json` 只保存结构数据，不保存名称和描述。

```json
[
	{
		"id": "Strike",
		"image": "images/cards/strike.png",
		"pool": ["ironclad"],
		"type": "attack",
		"rarity": "basic",
		"cost": 1,
		"variables": { "Damage": 6 },
		"keywords": []
	}
]
```

`pool` 是卡的权威归属字段，可包含多个标签（模组标签如 `fgo` 与角色色如 `silent` 并存）；展示用 `color` 由加载层从 `pool` 中首个合法角色色派生，无需手写。

### 自定义卡牌稀有度（cardRarities）

`cards.json` 的 `rarity` 不再限于内置枚举：模组可注入任意自定义 id（字母或数字开头，仅含字母、数字、`_`、`.`、`-`），例如 FGO 的 `"rarity": "NoblePhantasm"`。加载层会**自动发现**所有未被声明的自定义值并注册成独立筛选项（显示名由驼峰 id 拆分，如 `NoblePhantasm` → `Noble Phantasm`），使其参与稀有度筛选、排序与搜索；无需针对具体值改代码。

如需定制显示与卡面，在 manifest 中声明元数据：

```json
{
	"id": "fgo",
	"cardRarities": {
		"NoblePhantasm": {
			"name": "Noble Phantasm",
			"nameZh": "宝具",
			"color": "#ffd700",
			"base": "ancient"
		}
	}
}
```

| 字段 | 说明 |
| --- | --- |
| `name` | 默认显示名；省略时由 id 拆分生成 |
| `nameZh` | 中文显示名，写入 `labels.zhs` |
| `labelKey` | 本地化键，默认 `RARITY_<id>.title`；各 locale 从 `localization/{locale}/*.json` 读取，优先级高于 name / nameZh |
| `color` | 列表标签与悬浮提示的稀有度色 |
| `banner` / `outline` / `fullArt` | 卡面横幅对应的内置稀有度、标题描边色、是否全幅；省略时继承 `base`，再回退默认值 |
| `base` | 继承的内置稀有度（如 `ancient`）：提供默认卡面资源与排序位置，并让筛选该内置稀有度时也匹配这些卡 |

行为约定：

- 筛选 `?rarity=NoblePhantasm` 只显示该自定义稀有度的卡；声明了 `base` 时，筛选 `?rarity=ancient` 也会包含它们。
- 排序：内置按 `RARITIES` 顺序；带 `base` 的自定义值紧跟其 base，其余按注册顺序排在内置之后。
- 同名自定义 id 以先加载的模组为准；内置 id 不可被覆盖。
- 提取配置 `scripts/mod-extract/mods/fgo.json` 用 `card_rarities` 保存同一份定义，`pnpm mod:extract` 会写回 manifest 并保留 `cards.json` 中的原始自定义值；新增自定义稀有度时两边同步即可。

### 卡牌升级（upgrade）

升级后的变化统一写在 `upgrade` 对象里，只声明发生变化的属性；未声明的属性继承基础值。数值仅为示例：

```json
{
	"id": "Abrasive",
	"pool": "silent",
	"type": "power",
	"rarity": "rare",
	"cost": 3,
	"variables": { "ThornsPower": 4, "DexterityPower": 1 },
	"keywords": ["Sly"],
	"upgrade": {
		"cost": 2,
		"variables": { "ThornsPower": 5 },
		"keywords": ["Sly", "Innate"]
	}
}
```

| 属性 | 升级语义 | 原因 |
| --- | --- | --- |
| `cost`、`secondEnergy` 等普通字段 | 覆盖 | 只写新值，不必重复基础值 |
| `variables` | 浅合并 | 只覆盖变化的变量，其余沿用基础值 |
| `keywords` | 完整替换 | 升级既可能加关键词，也可能移除关键词 |

运行时由 `resolveCard(card, upgraded)` 一次算出最终属性，`isUpgradable(card)` 以 `upgrade` 是否存在为准；UI 不再按字段分别判断升级。仅在描述里通过 `{IfUpgraded:...}` 变化的卡可写 `"upgrade": {}`。

`upgrade` 的合法键由 `src/lib/data/cards.ts` 的 `CardAttributes` 决定，加载层按同一张校验表校验。以后新增 `exhaust`、`retain`、`ethereal` 等可升级属性时，只需扩展 `CardAttributes` 与校验表，数据结构和 UI 都不用改。

`scripts/parse_cards.py` 从反编译源码生成该结构，默认写回 `cards.json`；设置环境变量 `CARDS_OUT` 可输出到别处试跑。脚本会保留已有 `pool` 与手工校正的变量，并提取 `EnergyCost.UpgradeBy`、`AddKeyword` / `RemoveKeyword` 及索引式变量升级。

```json
[
	{
		"id": "FifthForcePower",
		"group": "Other",
		"stack": "Intensity",
		"behavior": "Permanent"
	}
]
```

`powers.json` 中的 `icon` 相对路径同样解析为 `/mods/{modid}/...`。

遗物与药水使用同样的结构数据 + 本地化文本模式：

```json
[
	{
		"id": "Akabeko",
		"rarity": "uncommon",
		"character": "any",
		"tags": ["Vigor"],
		"image": "images/relics/akabeko.png",
		"variables": { "VigorPower": 8 }
	}
]
```

```json
[
	{
		"id": "BlockPotion",
		"rarity": "common",
		"character": "any",
		"tags": ["Block"],
		"image": "images/potions/block_potion.png",
		"variables": { "Block": 12 }
	}
]
```

`rarity` 取值：遗物为 `starter` / `common` / `uncommon` / `rare` / `ancient` / `shop` / `event` / `special`，药水为 `common` / `uncommon` / `rare` / `special`。`character` 为 `any`、`ironclad`、`silent`、`regent`、`necrobinder` 或 `defect`。遗物可额外声明 `upgraded: true` 与 `ancient`（先古来源）。

描述中的 `{Variable}` 占位符会由 `variables` 替换；中文模板专属变量可放在 `variablesZh` 中（例如附魔名称）。

## 基础游戏（sts2）

`static/mods/sts2/manifest.json` 使用 `other` 且前缀为空，因此卡牌 `StrikeIronclad` 对应 `STRIKE_IRONCLAD.title` / `.description`，`DemonForm` 对应 `DEMON_FORM.*`，Buff `AccelerantPower` 对应 `ACCELERANT_POWER.*`，遗物 `Akabeko` 对应 `AKABEKO.*`，药水 `BlockPotion` 对应 `BLOCK_POTION.*`。基础游戏的 Buff、遗物、药水与模组声明的内容都会汇入对应页面。

## Buff 页面的来源 / 交互引用

`sources` 与 `interactions` 属于游戏数据关系，写在 `static/mods/{modid}/powers.json` 中；`src/lib/data/power-wiki.json`（及其中文镜像）只保留叙述字段（`title`、`stackType`、`text`、`order`、`effectsImmune`）。

引用**只保存实体标识**，不保存名称、描述、悬浮提示或分组文案：

```json
{
	"id": "VulnerablePower",
	"group": "Counter",
	"sources": [
		{
			"key": "onEnemies",
			"groups": [
				{
					"kind": "card",
					"partition": "ironclad",
					"refs": [{ "type": "card", "id": "Bash" }]
				},
				{
					"kind": "relic",
					"partition": "any",
					"refs": [{ "type": "relic", "id": "BagOfMarbles" }]
				},
				{
					"kind": "potion",
					"partition": "any",
					"refs": [{ "type": "potion", "id": "VulnerablePotion" }]
				}
			]
		}
	],
	"interactions": []
}
```

- `type` / `kind` 取 `card`、`relic`、`potion`、`power`，与 `src/lib/entities.ts` 的实体类型一致；`id` 是 `cards.json` / `relics.json` / `potions.json` / `powers.json` 中的原始 ID。
- `key`（区段）、`kind`（分组标题）、`partition`（分组副标题）都是**结构键**，不是展示文本。`variant` 只用于区分同一实体的不同形态（例如 `MadScience` 的 `sapping`），同样不写死文案。
- 被引实体的名称与描述由 `static/mods/{modid}/localization/{eng,zhs}/{cards,relics,potions,powers}.json` 的 `.title` / `.description` 提供；卡牌数值与卡池来自 `cards.json`，遗物 / 药水变量来自 `relics.json` / `potions.json`。两个 locale 的键必须成对存在。
- 区段标题、分组标题与副标题来自 `static/mods/{modid}/localization/{eng,zhs}/wiki.json`，键名规则为 `WIKI_SECTION_<KEY>`、`WIKI_GROUP_<KIND>`、`WIKI_PARTITION_<PARTITION>`、`WIKI_VARIANT_<VARIANT>`（驼峰键转大写下划线）；eng / zhs 两个文件的键集合必须完全一致。
- `src/lib/data/power-references.ts` 负责读取虚拟模组数据、校验引用并解析成当前语言的渲染结构；`/power/[id]` 的 universal load 调用 `powerReferenceDetails()`，`WikiSources.svelte` 只渲染解析结果。链接由 `entityHref()` 生成。
- 新增引用时运行 `pnpm test:unit` 中的 `power-references.spec.ts`：它会检查引用能否解析到游戏数据、中英文本是否配对、以及 wiki 文件中是否残留硬编码条目。
