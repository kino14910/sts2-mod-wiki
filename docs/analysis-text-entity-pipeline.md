# STS2 Wiki 文本处理与实体数据架构

> 文本链路消费 `virtual:mods` 提供的统一数据。已配置构建导入的 Mod 来自
> `generated/mods/{modId}/bundle.json`，原版离线数据暂由 legacy 适配器读取。
> 内部实体保留 rawId；公共链接使用 Mod 作用域 ID。路由／社区迁移由对应集成模块负责，
> 唯一旧 ID 可解析用于重定向，裸冲突 ID 拒绝。合同见 [公共身份](public-entity-identity.md)。

## 1. 职责边界

| | GameText | WikiText |
| --- | --- | --- |
| 输入 | 游戏本地化原始文本（卡牌 / 遗物 / 药水 / 能力描述、卡面） | Wiki 页面正文、内容编辑、来源列表 |
| 匹配范围 | **仅 `[gold]` 范围内的可见文本** | **所有可见文本**，与颜色 / 字重无关 |
| 匹配依据 | 游戏用金色高亮标记实体名，样式状态直接来自 `[gold]` 标签 | 正文里出现实体名就应可链接 |
| parser | `src/lib/text/game-text/`（独立） | `src/lib/text/wiki-text.ts`（独立） |
| 共享 | `EntityRef` / `GameEntity` / `EntityNameIndex` 扫描器、`bbcode.ts` 标签表、显式图标语法、`WikiEntity.svelte` | 同左 |
| 歧义 | 不生成链接，保留为普通文本 | 生成 `ambiguous` AST 节点，保留全部候选，不出确定链接 |

两套 parser 不合并：GameText 需要变量求值、gold 上下文与卡面样式；WikiText 需要
`[[type:id|label]]`、Wiki 图标语法、升级值 `(n)` 与 tooltip 词条。

## 2. 数据来源与内容边界

```
DLL / PCK / 构建清单（只读）
  → 提取证据与标准化 → generated/mods/{modId}/bundle.json
  │                     ├ sourceLocalization：PCK 原始模板，不求值
  │                     ├ localization：代码选择的运行时模板及别名
  │                     └ data / catalog / assets：实体、变量、关联与资源
  │ 构建导入适配器
  ├─────────────────────────────────────┐
static/mods/sts2/...（原版 legacy 离线数据）│
static/localization/...（关键词）          │
  │ legacy 适配器                         │
  └────────────── virtual:mods ───────────┘
  ▼
data/mods.ts（CARDS / RELICS / POTIONS / MOD_POWERS / KEYWORD_LOCALES / modContentText）
  ├ data/entities.ts  GameEntity 判别联合（card/relic/potion/power/keyword）
  │                    SCOPED_INDEX: modId + entityKey → GameEntity
  │                    INDEX: entityKey → 唯一 GameEntity / null（冲突）
  ├ data/localize.ts  原始模板、逐字段语言回退及对应变量
  └ src/lib/entities.ts  公共 EntityRef / entityKey / entityHref（保持既有 ID）
  ▼
data/entity-name-index.ts  名称候选索引（唯一名称来源）
  ▼
GameText / WikiText
```

- 已配置构建导入的 Mod 不再读取对应手工目录。`virtual:mods` 中保留的旧逻辑文件键
  只是兼容接口，不代表实际数据来源；导入流程见 [构建产物导入](build-import.md)。
- 原始构建产物、提取证据、标准化 bundle、Wiki 编辑内容和组件样式分层保存。
  社区章节及其历史不由导入器覆盖。组件不解析 DLL/PCK，也不承担数据迁移。
- `localizeEntity()` 保留未求值模板，名称与描述分别回退英文并记录实际语言；
  中文变量覆盖只用于实际中文描述。`localizedCard()` 等一参 wrapper 可安全用于
  `Array.map`，显式语言使用 `localizedCardForLocale()` 等独立函数。
- 旧 sts2 遗物／药水的 `percentMore()` 变量由加载边界的
  `adaptLegacyCollectionVariables()` 转换：依据对应语言模板，把显示百分比 `25`
  转成原始倍率 `1.25`。仅 `legacy-static` 且 `modId=sts2` 转换，build 数据不转换，
  不按数值大小猜类型，也不重复转换。模板原文不受影响。
- `ScopedEntityRef` 可携带 `modId`，`listEntityRefs()` 保留全部作用域候选。
  重复公共 ID 的无作用域 `findGameEntity()` 返回 `null`，`hasGameEntity()` 返回 `false`；
  不依赖加载顺序选中实体，冲突记录在 `ENTITY_ID_CONFLICTS`。
- `entity-identity.ts` 是不依赖目录、SvelteKit 或虚拟模块的公共身份 helper。
  加载边界注册全部 owner 后，非 sts2 实体 ID 为 `modId:rawId`；sts2 平时保留 rawId，
  同类型 rawId 跨 Mod 冲突时也使用 `sts2:rawId`。`resolvePublicEntityRef()` 返回原始 ID 和
  明确 Mod，裸 ID 仅唯一时解析。`publicEntityId()` / `toPublicEntityRef()` /
  `publicEntityKey()` / `entityHref()` 统一生成公共身份，原有 `entityKey()` 仍是序列化函数。
- 目录冲突不再阻止加载。`findGameEntity()` 接受 scoped raw ref、明确前缀的公共 ID 和
  唯一旧 ID；同类型同 ID 的两个 TeslaCoil 均保留，并生成不同的公共 URL。
  `cards.ts` / `collections.ts` 只相对导入纯 helper，仍可被 Node strip-types 校验器独立读取。
- `power-wiki.ts` 的全局名称去重使用 scoped key，不能靠相同 rawId 把两个 Mod 合并；
  `power-references.ts` 按公共 power ID 保存显式 sources/interactions，并保留引用的 Mod。
  普通 assembly refs、继承 hover tip 及描述文本提及都不自动升级为施加能力的来源证据。
- `GlossaryEntry.aliases`、`GLOSSARY_ZH`、`wiki-aliases.ts`、跨语言 `.title`、实体 `id`
  都作为**同一张候选表**的输入，不在两套文本系统里各自建表。
- `power-wiki.ts` 的 `WIKI_TERMS` / `WIKI_TERM_NAMES` 只保留两个非匹配用途：
  无对应 GameEntity 的 tooltip 词条、显式图标后的标签合并。实体名称匹配不再读它。

## 3. EntityNameIndex 与消歧策略

`getEntityNameIndex(locale)` 缓存返回 `{ locale, candidates, conflicts, terms, wikiTerms, pattern, wikiPattern }`。

- `candidates`：`归一化名称 → EntityNameEntry[]`，**保留全部同名候选**，构建期不消解、不丢弃。
  `EntityNameEntry = { name, ref, entity, source, scope, enemyOnly }`。
- `source`：`title`（当前语言标题）/ `alias`（别名、跨语言标题）/ `id`（结构 id）。
- `scope`：`game`（游戏文本可见，同时也对 Wiki 可见）/ `wiki`（跨语言标题与 id，仅 Wiki 可见）。
  `terms` / `pattern` 只含 game 范围，`wikiTerms` / `wikiPattern` 含全部。
  GameText 用 `pattern`，因此新增的 Wiki 名称**不会扩大 GameText 的匹配范围**。
- `conflicts` 仅作诊断（`cross-type` / `same-type`），不决定结果。

匹配阶段由 `EntityMatchContext` 显式控制：

| 字段 | 含义 |
| --- | --- |
| `locale` | 索引语言，默认 `getLocale()`，按 locale 缓存 |
| `scope` | `game`（默认）/ `wiki` |
| `strategy` | `game`（默认，歧义不链接）/ `wiki`（歧义保留） |
| `prefer` | 调用方显式传入的类型顺序 |
| `current` | 当前实体，由渲染层禁用自链接；不靠删除候选把同名实体误判为唯一 |
| `modId` | 优先选择对应 Mod 候选；无本 Mod 候选时保留其他候选 |

- `GAME_ENTITY_PREFERENCE = power > keyword > relic > potion > card`：游戏金色高亮的默认行为，
  由 `parseGameText()` 显式以 `strategy: 'game'` 使用；`options.prefer` 可覆盖。
- `WIKI_ENTITY_PREFERENCE = card > relic > potion > power > keyword`：由 `WikiText` 显式传入，
  **不复用 GameText 优先级**。`strategy: 'wiki'` 且不传 `prefer` 时完全不按类型优先。
- 单一扫描器 `scanEntityNames(text, context)` 是 GameText / WikiText 共用的唯一匹配逻辑；
  `matchEntityNames()` 只返回已唯一确定的实体，`resolveEntityNameDetailed()` 返回
  `none / resolved / ambiguous` 与全部候选。
- 变量 `{...}` 区间、ASCII 词边界、共享正则的 `lastIndex` 复位都在扫描器内统一处理。
- ASCII 专有名词的大小写策展（小写 `inferno` 不链接）只在 WikiText 层做，索引仍大小写不敏感。

## 4. GameText 流程

```
Localization (含 [gold] / [blue] / [red] / [b] / {Var:...})
  → parseGameTemplate() / resolveGameTemplate()  先解析完整表达式并选择条件分支
  → tokenizeGameText()   求值结果的 BBCode / 显式图标，保留变量来源
  → parseGameTextNodes()  原文与分支使用同一个标签栈，允许分支闭合外层样式
  → resolveInline()      gold 上下文传递 + 可见文本实体匹配（不再次求值）
        ├ 条件分支继承 gold；标量变量不因外层 gold 自动变成实体链接
        └ 实体：matchTextEntities() → matchEntityNames()（scope/strategy = game）
  → GameText.svelte      递归 snippet；无 {@html}
        tag → <span style:...>   entity → WikiEntity(ref)
        variable → WikiVariable  icon → <img> / 诊断占位
```

- **gold 来源**：`bbcode.ts` 的 `NAMED_COLORS.gold = '#EFC851'`，
  `styleOf()` 把命名标签记成 `colorName: 'gold'`，`isGoldStyle()` 只认这个状态。
  数据里没有 `[color=...]`；`[color=#EFC851]` 即使同色也**不是** gold，不触发实体匹配。
- 样式继承：带颜色的 tag 重新判定 gold；`[b]` / `[i]` / `[u]` / `[font]` 等无颜色 tag 继承父级。
  闭合外层 tag 时同时丢弃仍打开的内层 tag，避免后续文本被错误继承。
- 只有 gold 范围内文本参与匹配；普通文本、blue / red / bold 等不参与。
- `game-template.ts` 是 GameText、card-text 和 collection-text 的共享纯求值层，支持
  `{Variable}`、`diff()`、`inverseDiff()`、`abs()`、`energyIcons()`、
  `starIcons()`、`percentMore()`、`percentLess()`、`IfUpgraded`、`InCombat`、`show:`、
  `choose()`、`cond:`、`plural()` 的已覆盖形式。未实现的 SmartFormat／语言复数规则及缺失变量
  保留原文并输出诊断，不猜测语义。百分比使用原始倍率、游戏的中点取偶舍入，不附加 `%`；
  能量／星数 1–4 重复图标，其他数值使用数字加单图标。
- `GameTextOptions`：除 `CardTextOptions` 外还有 `locale` / `mode` / `collectionVariables` /
  `current` / `prefer` / `matchEntities` / `interactive` / `modId`。
- 卡面缩略图位于 `<a>` 内，用 `matchEntities: false`；大图描述用 `interactive: false`。

## 5. WikiText 流程

```
Wiki Content（可含 BBCode、[[type:id|label]]、StS2 ...png / §ICON_X§、(n)）
  → tokenizeSegments()   先记录显式引用 / 显式图标区间，再解析 BBCode 标签
  → 可见 text runs       标签名、标签参数、不可见标记都不进入文本
  → tokenizeInline()     显式引用 / 显式图标（含标签合并）/ 升级值先解析
  → matchVisibleText()   scanEntityNames(scope:'wiki', strategy:'wiki', prefer: WIKI_ENTITY_PREFERENCE)
        ├ resolved   → entity 节点（EntityRef → 已本地化 WikiEntry：href / tooltip / 图标）
        ├ ambiguous  → ambiguous 节点（保留全部候选 ref）
        └ 剩余片段   → splitTooltipTerms()：仅无 GameEntity 的 tooltip 词条
  → WikiNode AST → WikiText.svelte 递归 snippet
```

- 匹配只发生在**可见文本节点**，不是对原始 Wiki 文本做全局正则替换。
- gold / blue / red / b / i / u 以及多层嵌套 BBCode 中的可见文本都会匹配；
  相邻样式节点各自独立，不跨语义节点合并。
- 显式引用 `[[type:id|label]]`、显式图标、升级值语法都先被解析，其占用的区间不再进入实体匹配，
  因此不会产生重复或重叠链接。
- 消歧失败时渲染 `<span class="wiki-ambiguous" data-entity-candidates="[...]">`，
  不带 `<a>`、不带多个重叠链接、候选信息不丢失。
- 保留原有：升级值绿色高亮、实体链接、tooltip、图标、自链接禁用（`WikiEntity.svelte`）。
- `WikiText.svelte` 支持可选 `locale` / `current` / `modId`，语言默认按 `getLocale()`。

## 6. AST 与渲染

| GameTextNode | WikiNode |
| --- | --- |
| `text` | `text` |
| `tag`（带 `GameTextStyle` 与 children） | `tag`（带 `WikiStyle` 与 children） |
| `entity`（`EntityRef` + candidates） | `entity`（`EntityRef` + WikiEntry + icon） |
| — | `ambiguous`（`refs` + candidates） |
| `variable`（name/raw/value/children） | — |
| `icon`（energy/star/asset + IconRef） | `icon`（共享解析、独立资源节点）或实体 inline icon |
| `break` | `break` / `upgraded` |

`WikiEntity.svelte` 同时支持 `entry`（Wiki 旧调用方）与 `ref`（统一引用），
负责跳转、tooltip、图标与当前页禁用。`GameText.svelte` / `WikiText.svelte` 模板标记紧贴，
避免空白进入 `textContent`。

## 7. 显式图标与资源解析

- `src/lib/text/game-text/icon-syntax.ts` 统一解析 `StS2 ...png`、`§ICON_X§`、
  `§ICON_fgo:powers/shared.png§` 和 `[img]res://Fgo/images/...[/img]`。
  两套文本 parser 共用 `findExplicitIcons()` / `resolveExplicitIcon()`；升级值 `(n)` 另行处理。
- 显式图标节点不进入普通实体名称匹配；`GameText` 由 tokenizer 过滤重叠 hits，
  `WikiText` 由 `tokenizeInline()` 先消费整段。
- `IconRef` 判别联合：
  - `energy` / `star`：普通图标（变量求值产生的图标标签）。
  - `entity`：实体图标，直接复用 `EntityRef`。
  - `asset`：普通 / 显式资源引用，可带 `path`（Mod 内相对路径）。
- `classifyIconRef()`：显式资源名在 game 范围内唯一指向某实体时升级为 `entity` 引用；
  歧义名、普通图标、带 Mod 命名空间的资源保持 `asset`。
- 显式路径通过 `iconPathKey(modId 内相对路径)` 精确查询资源表，缺失时返回诊断，
  不再退回 basename。无路径旧语法才使用兼容 basename 键；
  **仅 Vanilla**（无显式 modId 或 `sts2`）可回退实体图标索引。
  显式非 Vanilla Mod 资源查找失败直接返回诊断，不回退 Vanilla 同名实体，也不串用其他 Mod 资源。
- `iconDiagnostic()` 对缺失 / 歧义资源输出可诊断信息，组件渲染占位而非静默丢图。

## 8. Mod 图标命名空间与冲突

构建导入资源与 legacy 资源适配后注入 `virtual:mods`：
`iconFiles`（`modId → key → url`）与 `iconConflicts`（诊断数组）。
导入资源 URL 指向 `static/imported/{mod}/{fingerprint}/...`，文本组件不依赖其物理目录。

- **唯一标识**：`Mod ID + iconPathKey(相对路径)`（保留扩展名、大小写归一、正斜杠）。
  例：`powers/vulnerable_power.png` 与 `ui/...` 不再互相覆盖。
- **兼容键**：`normalizeIconKey(basename)` 仍存在，供不带路径的旧语法查询。
- **冲突规则**：不静默忽略。`indexIconFiles()` 分组记录 `basename` / `path-case` 冲突及全部路径，
  确定性选优（非 `/beta/` > 路径更短 > 字典序），构建期输出 `[mods] ... 图标资源键冲突 N 项` 诊断，
  并把完整列表写入 `iconConflicts`。
- 当前真实数据在 `sts2` 下有 40 组 basename 冲突（主要是 `relics/` 与 `relics/beta/`），
  按上述规则选优并输出诊断；不同 Mod 的资源表按 `modId` 天然隔离。
- 能量 / 星等命名图标仍走 `icon-assets.ts` 的 `NAMED_ICONS` 路径，与资源索引互不干扰。

## 9. 验证与剩余事项

- `game-template.spec.ts` / `text-pipeline.spec.ts` 使用实际游戏／Fgo 模板快照，覆盖
  嵌套条件、跨分支标签栈、倍率舍入、能量图标、逐字段语言回退、资源精确路径和命名空间冲突。
- `canonical-catalog.spec.ts` 验证实际 Bash 数据、本地化／引用一致性、Fgo 升级文本、
  BowlerHat legacy 加载转换；`TextRendering.svelte.spec.ts` 验证组件渲染。
- `public-entity-identity.spec.ts` 覆盖身份前缀、raw 冲突拒绝、唯一旧 ID、公开 key 往返和目录重载；
  `text-pipeline.spec.ts` / 浏览器测试覆盖跨 Mod 链接、显式引用、glossary 索引及来源作用域。
  `entity-id-conflicts.spec.ts` 保留旧 raw-ID 诊断函数测试，并验证实际实体模块允许 scoped 冲突。
- 最终类型检查、全量服务端／浏览器测试和生产构建由主集成验证记录，本文不沿用旧架构测试数量
  或旧构建结果作为本次验收结论。
- 已核实 `card:TeslaCoil` 是实际跨 Mod 同名实体：游戏源码为 0 费、3 伤害，
  Fgo 源码及导入 bundle 为 1 费、9 伤害。公共身份分别为 `sts2:TeslaCoil` / `fgo:TeslaCoil`，
  不合并，不改 raw 数据，不再以全目录 throw 阻断构建。

已知限制 / 兼容性风险：

1. `ambiguous` 节点目前只做可见标记 + `data-entity-candidates`，没有交互式候选选择器；
   候选信息完整保留。`[[type:id|label]]` 可解决部分名称歧义，但不能指定跨 Mod 的相同公共 ID。
2. WikiText 对 ASCII 专有名词仍要求大小写一致（保留原有策展行为）；
   小写普通词不会自动链接，跨语言标题与 id 只在 `scope: 'wiki'` 生效。
3. `wikiTerms / wikiPattern` 包含跨语言标题与 id，正则规模大于 `terms`；
   目前构建与测试耗时正常，若后续新增大量 Mod 需关注匹配耗时。
4. `cardTextToHtml()` / `collectionTextToHtml()` 保留为纯字符串 API（`*ToPlain()` 仍在使用），
   生产组件已全部走 GameText / WikiText。
5. 图标 basename 兼容键在冲突时只能选一个资源；需要精确资源时必须使用带相对路径的显式引用。
6. 路由形状仍为 `/cards/{id}` 等，但 id 可以是 URI 编码后的 `modId:rawId`。
   `[[type:modId:rawId|label]]` 支持显式选择 Mod；页面匹配作用域不会覆盖已有前缀。
   根 `entityKey()` / `wikiPageKey()` 仍是序列化函数，server 必须先规范化公共 ref，再读写社区键。
   数据库旧记录迁移必须依据已记录的 mod_id；缺失归属的冲突历史不可按当前目录顺序分配。
   URL 重定向、社区迁移及旧锚点的完整验证归路由／server 集成；本文件不宣称这些已全部完成。
   删除旧 Mod 后由另一 Mod 复用旧 ID 的情况，仍需数据库归属校验防止历史误关联。
