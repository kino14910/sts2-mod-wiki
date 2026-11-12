# STS2 Wiki 文本处理与实体数据架构

> 与当前工作区源码一致。历史实现中的 `GOLD_SPAN`、从 HTML 反向解析金色段、
> 组件层 `{@html}` + 正则切段等描述均已删除，那些路径已不存在。

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

## 2. 数据层（唯一来源）

```
static/mods/{modId}/manifest.json + *.json + localization/{eng,zhs}/*.json
static/localization/{eng,zhs}/card_keywords.json
  │ vite.config.ts modDataPlugin() → virtual:mods
  ▼
data/mods.ts（CARDS / RELICS / POTIONS / MOD_POWERS / KEYWORD_LOCALES / modContentText）
  ├ data/entities.ts  GameEntity 判别联合（card/relic/potion/power/keyword）
  │                    INDEX: entityKey → GameEntity；listEntityRefs() / findGameEntity()
  └ src/lib/entities.ts  EntityRef / entityKey / entityHref（唯一引用类型）
  ▼
data/entity-name-index.ts  名称候选索引（唯一名称来源）
  ▼
GameText / WikiText
```

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
| `current` | 当前实体，用于排除自链接候选 |

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
  → tokenizeGameText()   BBCode hits + findExplicitIcons() hits（重叠区过滤）
  → parseGameTextNodes()  AST：tag(text/style/children) / text / icon / break
  → resolveInline()      变量求值 + gold 上下文传递 + 分段实体匹配
        ├ 变量：resolveCardTextToBBCode() / resolveCollectionText()，结果递归解析
        │       变量子节点始终 gold=false，内部不做实体匹配
        └ 实体：matchTextEntities() → matchEntityNames()（scope/strategy = game）
  → GameText.svelte      递归 snippet；无 {@html}
        tag → <span style:...>   entity → WikiEntity(ref)
        variable → WikiVariable  icon → <img> / 诊断占位
```

- **gold 来源**：本地化文件里共 1994 处 `[gold]`；`bbcode.ts` 的 `NAMED_COLORS.gold = '#EFC851'`，
  `styleOf()` 把命名标签记成 `colorName: 'gold'`，`isGoldStyle()` 只认这个状态。
  数据里没有 `[color=...]`；`[color=#EFC851]` 即使同色也**不是** gold，不触发实体匹配。
- 样式继承：带颜色的 tag 重新判定 gold；`[b]` / `[i]` / `[u]` / `[font]` 等无颜色 tag 继承父级。
  闭合外层 tag 时同时丢弃仍打开的内层 tag，避免后续文本被错误继承。
- 只有 gold 范围内文本参与匹配；普通文本、blue / red / bold 等不参与。
- 变量语法完整保留：`{Variable}`、`diff()`、`inverseDiff()`、`abs()`、`energyIcons()`、
  `starIcons()`、`percentMore()`、`percentLess()`、`IfUpgraded`、`InCombat`、`show:`、
  `choose()`、`cond:`、`plural()`。
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
- `WikiText.svelte` 新增可选 `locale` / `current` props，默认仍按 `getLocale()`。

## 6. AST 与渲染

| GameTextNode | WikiNode |
| --- | --- |
| `text` | `text` |
| `tag`（带 `GameTextStyle` 与 children） | `tag`（带 `WikiStyle` 与 children） |
| `entity`（`EntityRef` + candidates） | `entity`（`EntityRef` + WikiEntry + icon） |
| — | `ambiguous`（`refs` + candidates） |
| `variable`（name/raw/value/children） | — |
| `icon`（energy/star/asset + IconRef） | 显式图标走 `entity` + inline icon |
| `break` | `break` / `upgraded` |

`WikiEntity.svelte` 同时支持 `entry`（Wiki 旧调用方）与 `ref`（统一引用），
负责跳转、tooltip、图标与当前页禁用。`GameText.svelte` / `WikiText.svelte` 模板标记紧贴，
避免空白进入 `textContent`。

## 7. 显式图标与资源解析

- `src/lib/text/game-text/icon-syntax.ts` 的 `ICON_PATTERN` =
  `EXPLICIT_ICON_PATTERN`（`StS2 ...png` / `§ICON_X§`）+ `UPGRADED_PATTERN`（`(n)`，非图标）。
  Vanilla 与 Mod 共用 `findExplicitIcons()` / `iconToken()`，Mod 只多带一个 `modId`，无第二套 parser。
- 显式图标节点不进入普通实体名称匹配；`GameText` 由 tokenizer 过滤重叠 hits，
  `WikiText` 由 `tokenizeInline()` 先消费整段。
- `IconRef` 判别联合：
  - `energy` / `star`：普通图标（变量求值产生的图标标签）。
  - `entity`：实体图标，直接复用 `EntityRef`。
  - `asset`：普通 / 显式资源引用，可带 `path`（Mod 内相对路径）。
- `classifyIconRef()`：显式资源名在 game 范围内唯一指向某实体时升级为 `entity` 引用；
  歧义名、普通图标、带 Mod 命名空间的资源保持 `asset`。
- `resolveIconSrc()` 顺序：
  1. 显式路径 `iconPathKey(modId 内相对路径)` 精确命中；
  2. 兼容 basename 键（`normalizeIconKey`）；
  3. **仅 Vanilla**（无显式 modId 或 `sts2`）才回退 `wiki-links.ts` 的实体图标索引。
  显式非 Vanilla Mod 资源查找失败直接返回诊断，不回退 Vanilla 同名实体，也不串用其他 Mod 资源。
- `iconDiagnostic()` 对缺失 / 歧义资源输出可诊断信息，组件渲染占位而非静默丢图。

## 8. Mod 图标命名空间与冲突

`vite.config.ts` 调用 `scripts/mod-icons.ts` 的 `collectModIcons()`，产物注入 `virtual:mods`：
`iconFiles`（`modId → key → url`）与 `iconConflicts`（诊断数组）。目录结构未迁移。

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

- `pnpm check`：0 errors / 0 warnings。
- `pnpm exec vitest run`：29 文件 / 240 测试全过（含 client chromium 组件测试）。
- `pnpm build`：通过；预渲染只剩 7 个既有缺失图片 404，与文本链路无关。
- 顺带修复 `card-text.spec.ts` 里硬编码的 `D:/projects/...` 数据路径，改为工作区相对路径。
- 三条命令建议逐条执行：连续串在同一 shell 时，`svelte-kit sync` 与 paraglide 消息目录生成偶发竞态
  （曾瞬时报 30+ 个 `m.*` 消息键缺失）；逐条执行时 check 连续 3 次均为 0 errors。
  `vite.config.ts` 的构建期工具已改为 `load()` 内按需动态导入，减少配置加载阶段的额外模块初始化。

已知限制 / 兼容性风险：

1. `ambiguous` 节点目前只做可见标记 + `data-entity-candidates`，没有交互式候选选择器；
   候选信息完整保留，但用户需要显式 `[[type:id|label]]` 才能指定实体。
2. WikiText 对 ASCII 专有名词仍要求大小写一致（保留原有策展行为）；
   小写普通词不会自动链接，跨语言标题与 id 只在 `scope: 'wiki'` 生效。
3. `wikiTerms / wikiPattern` 包含跨语言标题与 id，正则规模大于 `terms`；
   目前构建与测试耗时正常，若后续新增大量 Mod 需关注匹配耗时。
4. `cardTextToHtml()` / `collectionTextToHtml()` 保留为纯字符串 API（`*ToPlain()` 仍在使用），
   生产组件已全部走 GameText / WikiText。
5. 图标 basename 兼容键在冲突时只能选一个资源；需要精确资源时必须使用带相对路径的显式引用。
