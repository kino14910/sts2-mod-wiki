# 现状梳理：游戏文本处理与实体数据

> 重构第 1-6 步交付。全部结论来自当前本地工作区源码，未参考远端版本。

## 1. 数据链路

```
static/mods/{modid}/manifest.json + *.json + localization/{eng,zhs}/*.json
static/localization/{eng,zhs}/{card_keywords,mods}.json
  │ vite.config.ts modDataPlugin() → virtual:mods
  │   manifestFiles / dataFiles / localizationFiles / cardImageFiles / cardThumbFiles
  ▼
data/mods.ts 唯一加载层
  ├ MODS / MOD_BY_ID / CARDS / MOD_POWERS / RELICS / POTIONS
  ├ MOD_CONTENT_LOCALES[locale][modid][`{ENTRY_ID}.title|.description`]
  │   Key 由 mod-dependency.ts entryIdFor() 生成，读取入口 modContentText()
  └ KEYWORD_LOCALES[locale][`EXHAUST.title`]
  ▼
  ├ data/glossary.ts POWERS/KEYWORDS → ALL_ENTRIES → GLOSSARY_LINKS / TERM_PATTERN / TERM_INDEX
  ├ data/localize.ts getLocale() → localizedCard/localizedCollection/localizedEntry
  │                             → termIndex()/termPattern()（英文用 TERM_*，中文懒建 buildZhLinks()）
  ├ data/power-wiki.ts → WIKI_ENTRIES / WIKI_TERMS / GAME_REFS / WIKI_ENTITY_ALIASES / wikiEntryFor()
  └ data/entities.ts → INDEX: entityKey → GameEntity → findGameEntity()
        （仅经 server/wiki/page-service.ts 进入 SSR，组件层未直接使用）
```

- `src/lib/entities.ts`：`EntityRef` / `entityKey` / `entityHref`，6 类（含 `character`）。
- `src/lib/data/entities.ts`：`GameEntity` 判别联合，只注册 5 类（不含 `character`）。
- Keyword 无结构数据，`KEYWORDS` 硬编码于 `glossary.ts`，名称来自全局 `card_keywords.json`。
- 只使用 `.title` / `.description`；`smartDescription` 不进索引。

## 2. 文本链路

```
text/bbcode.ts（叶子，零内部依赖）
  stripBBCode / bbcodeToHtml → 输出 HTML 字符串
  中间态为扁平 Token[] + Frame[] 样式栈，不对外暴露、不是 AST
     ▲                            ▲
text/card-text.ts            text/collection-text.ts
 {Var:diff()} / energyIcons()  plural / energyIcons() / starIcons / show: / cond:
 / IfUpgraded / InCombat …     resolveCollectionText() 需调用方显式先执行
     ▲                            ▲
data/localize.ts、data/mods.ts、data/power-references.ts 反向 import text 层
```

`text → data` 全是 `import type`，运行时无循环；`data → text` 是实调用。

## 3. 组件调用关系

| 组件 | 输入 | 渲染 | 名称匹配来源 |
| --- | --- | --- | --- |
| `CardDescription.svelte` | `cardTextToHtml()` | `{@html}` 分段 + `WikiEntity` | `GOLD_SPAN` 正则反解 HTML 后查 5 个表 |
| `CardThumb.svelte` | `cardTextToHtml()` | `{@html}` | 无（卡面不链接） |
| `CollectionView.svelte` | `collectionTextToHtml()` | `{@html}` | 无 |
| `RichText.svelte` | 纯文本 | `<a>` / `<span>` | `termPattern()` + `termIndex()` + `matchAll` |
| `WikiText.svelte` | Wiki markdown | `WikiEntity` | 自建 `WIKI_TERM_NAMES` 正则 + 图标语法 |
| `WikiInline.svelte` | 遗物 Wiki 文本 | `HoverTooltip` | 自建 token 解析 |
| `WikiEntity.svelte` | `WikiEntry` 对象 | 跳转 / Tooltip / 图标 | 无 |

调用入口：`cards/+page.svelte` → `CardRow` → `CardThumb` + `CardDescription`；
`power/[id]/+page.svelte` → `RichText` + `WikiText` + `WikiSources`；
`relic/[id]/+page.svelte` → `WikiInline` + `RelicInfobox`；
`routes/power/[id]/+page.ts` 用 `stripBBCode` / `cardTextToPlain` / `collectionTextToPlain` 做名称反查与 meta。

## 4. 与重构目标的差距

1. BBCode 产物是 HTML 字符串，靠 `{@html}` 渲染，无法保留可组合的样式上下文。
2. `CardDescription.svelte:23` 用 `GOLD_SPAN` 从 HTML 反解金色段再查实体，属于「先转 HTML 再查实体」。
3. 名称匹配分散在 `glossary.ts` / `localize.ts` / `power-wiki.ts` / `RichText.svelte` / `WikiText.svelte` / `CardDescription.svelte` / `routes/power/[id]/+page.ts` 共 7 处。
4. `TERM_PATTERN` 用 `\b(...)\b`，中文无词边界，中文匹配不可靠。
5. 并行存在 6 套引用类型：`EntityRef` / `GameEntity` / `PowerEntityRef`+`WikiEntry` / `GlossaryLink` / `WikiTerm` / `InlineIcon`。
6. `termSegment()` 串联 `WIKI_ENTRIES`、`wikiTerm()`、`termIndex()`、`GLOSSARY_BY_NAME`、`cardWikiHref()` 五套查表。
7. Paraglide 为 cookie + `setLocale()` 整页 reload，locale 不进 props；`getLocale()` 只在 `localize.ts` 等少数模块内部调用。索引必须按 locale 缓存且默认参数取 `getLocale()`。

## 5. 复用 / 重构 / 新增清单

### 直接复用（保持不动）

| 模块 | 复用内容 |
| --- | --- |
| `src/lib/entities.ts` | `EntityRef` / `entityKey` / `entityHref` 作为唯一引用类型 |
| `src/lib/data/entities.ts` | `GameEntity` / `findGameEntity()` / `listEntityRefs()` 作为唯一实体数据源 |
| `src/lib/data/mods.ts` | `modContentText()` / `MOD_CONTENT_LOCALES` / `KEYWORD_LOCALES` / `MOD_BY_ID` 作为唯一 `.title` 来源 |
| `src/lib/data/mod-dependency.ts` | `localizationKeyFor()` / `resolveContentText()` / `entryIdFor()` |
| `src/lib/data/glossary.ts` | `GlossaryEntry.aliases` / `escapeRegExp()` / `ALL_ENTRIES` |
| `src/lib/data/zh.ts` | `GLOSSARY_ZH` 中文别名 |
| `vite.config.ts` | `modDataPlugin()` / `virtual:mods` / `static/mods/{modid}` 目录 |
| `text/card-text.ts` | 全部变量语法（`diff()` / `energyIcons()` / `IfUpgraded` / `plural()` …） |
| `text/bbcode.ts` | 命名色 / `[color=...]` / `[font=...]` / `renderTag` 图标能力 |
| `WikiEntity.svelte` | 跳转 / Tooltip / 图标 / 当前页禁用 |
| Paraglide | `getLocale()` / `setLocale()` |

### 后续步骤（4-7）需重构

| 模块 | 动作 |
| --- | --- |
| `text/bbcode.ts` | HTML 字符串 → AST，保留标签表与 `renderTag` 语义，未知标签回退文本 |
| `text/card-text.ts` / `collection-text.ts` | 输出改为可复用 token/AST，保留全部变量语法与调用方 |
| `CardDescription.svelte` | 删除 `GOLD_SPAN` 反解，改走 GameText |
| `CardThumb.svelte` / `CollectionView.svelte` / `RichText.svelte` | 迁移到 GameText |
| `WikiText.svelte` / `WikiInline.svelte` | 迁移游戏文本部分，保留 `[[...]]`、图标标记等 Wiki 专用语法 |
| `data/localize.ts` 的 `termIndex()/termPattern()`、`power-wiki.ts` 的 `GAME_REFS/WIKI_TERM_NAMES` | 转发到统一索引（保留签名，避免破坏调用方） |
| 6 套引用类型 | 统一到 `EntityRef`；`WikiEntity.svelte` props 改为 `ref` |

### 新增 / 修改文件（第 1-6 步累计）

| 文件 | 作用 |
| --- | --- |
| `src/lib/data/entity-name-index.ts` | 多语言实体名称候选索引 + 匹配阶段消解 |
| `src/lib/data/wiki-aliases.ts` | 从 `power-wiki.ts` 抽出的中文别名表，两处共用 |
| `src/lib/data/entity-name-index.spec.ts` | 17 项索引测试 |
| `src/lib/text/game-text/*.ts` | 统一 AST：types / tokenizer / parser / entity-matcher / inline / index |
| `src/lib/text/game-text/game-text.spec.ts` | 11 项 AST / 变量测试 |
| `src/lib/components/GameText.svelte` | 统一游戏富文本渲染（递归 snippet） |
| `src/lib/components/WikiVariable.svelte` | 变量节点渲染 |
| `src/lib/components/GameText.svelte.spec.ts` | 6 项浏览器组件测试 |
| `docs/analysis-text-entity-pipeline.md` | 本文档 |

修改：`power-wiki.ts`（共享别名表）、`bbcode.ts`（导出标签表 / helper，HTML 输出不变）、
`card-text.ts`（抽出 `resolveCardTextToBBCode()`，`cardTextToHtml` 复用）、
`WikiEntity.svelte`（新增 `ref?: EntityRef`，`entry` 兼容保留；压缩模板空白）。

## 6. 索引设计（决策 1 后）

- 结构：`getEntityNameIndex(locale = getLocale())` 返回 `{ locale, candidates, conflicts, terms, pattern }`。
- `candidates`：`归一化名称 → EntityNameEntry[]`，**保留全部候选实体**，每项
  `{ name, ref: EntityRef, entity: GameEntity, source, enemyOnly }`，实现「名称 → EntityRef → GameEntity」。
  构建期不做优先级消解；`conflicts` 只记录同名多候选（`cross-type` / `same-type`）供诊断。
- 名称来源：card/power/relic/potion 用 `modContentText(..., 'title', locale)`；keyword 用
  `KEYWORD_LOCALES[locale][`${id}.title`]`。缺当前语言时回退 `eng`。
- 别名来源：`GlossaryEntry.aliases`、`GLOSSARY_ZH[id].aliases`、`wiki-aliases.ts`
  （借 `eng` 的 `.title` 反查，保留全部候选）。同名同 ref 时 `.title` 覆盖 `alias`。
- **匹配阶段消解**：`resolveEntityName(name, context)` / `matchEntityNames(text, context)`。
  `EntityMatchContext = { locale, prefer, current }`。
  规则：单候选直接返回；多候选先按 `current` 排除自链接候选，再按 `prefer`
  （默认 `power > keyword > relic > potion > card`）取第一个有候选的类型，
  该类型内 `.title` 优先；若仍剩多个不同 ref 则返回 `null`，**不生成链接**。
  `prefer` 可由调用方覆盖，例如 Wiki 散文改用 `card` 优先。每个 match 同时带全部 `candidates`。
  真实数据：eng/zhs 各 149 组跨类型重名、3-4 组同类型歧义。
- 匹配：`terms` 按长度降序生成一个已转义的全局正则（懒构建、按 locale 缓存，
  渲染时不重建）；`matchEntityNames()` 同步遍历并重置共享正则的 `lastIndex`。
- 边界：仅当命中词首尾为 ASCII 单词字符时检查相邻字符，中文不依赖 `\b`。
- 变量保护：跳过 `{...}` 占位符区间。
- 语言切换：`getLocale()` 为默认参数，缓存按 locale 隔离；`setLocale()` 整页 reload 后自然失效。

## 7. 统一 AST / 变量 / 渲染（步骤 4-6）

```
parseGameText(text, options)
  ├ tokenizer.ts  BBCode → Token[]（复用 bbcode.ts 的 KNOWN_TAGS / parseArg）
  ├ parser.ts     Token[] → AST（tag 带 GameTextStyle，复用 NAMED_COLORS / sizeToUnit）
  └ inline.ts     文本节点 → 变量求值 + 实体匹配（仅 gold）
       ├ 变量：resolveCardTextToBBCode()（card）/ resolveCollectionText()（collection）
       │        求值结果递归解析成 children，图标标签转 icon 节点
       └ 实体：entity-matcher.ts → matchEntityNames(text, context)
```

- AST 节点：`text` / `tag` / `entity` / `variable` / `icon` / `break`；`tag` 自带样式并嵌套 children。
- 变量语法完整复用 `card-text.ts`，未重写；`cardTextToHtml()` 改为复用
  `resolveCardTextToBBCode()`，现有调用方与 HTML 输出不变。
- **只在金色节点内匹配实体**（决策 2）：`gold` 上下文沿 tag 链传递；带颜色的 tag 用
  `colorName === 'gold' || color === '#EFC851'` 判定，无颜色的 tag（`[b]` / `[i]` 等）继承父级。
  `[blue]{Amount}[/blue]` 产出 `tag > variable`，不产生实体；普通文本中的实体名不链接。
- 未知标签回退为文本；`[br]` → break；`[energy_icons=N]` / `[star_icons=N]` /
  `[energy]` / `[star]` → icon 节点。
- `GameText.svelte` 用递归 `{#snippet renderNode()}` 渲染，样式走 `style:` 指令，
  文本走 Svelte 插值，**无 `{@html}`**；entity 节点把 `EntityRef` 直接传给
  `WikiEntity.svelte`（新增 `ref` prop，`entry` 兼容保留）。
  模板标记必须紧贴，否则空白会进入 `textContent`。
- `GameTextOptions extends CardTextOptions`，新增 `locale` / `mode` /
  `collectionVariables` / `current` / `prefer` / `matchEntities` / `interactive`。

## 8. 两项设计决策的落地

1. **保留全部候选 + 匹配阶段消解**：见第 6 节。原「构建期按全局优先级丢弃候选」已移除；
   `conflicts` 从「判定结果」降级为诊断信息。跨类型优先级与 Wiki 散文 card 优先的差异，
   改由 `EntityMatchContext.prefer` 在调用时决定，不再二选一。
2. **只在金色节点内匹配**：见第 7 节。短英文名误匹配问题随普通文本不再匹配而消失。

## 9. 组件迁移（步骤 7）

已迁移到 `GameText`（生产代码中不再有 `{@html}` + 正则反解的组合）：

| 组件 | 迁移前 | 迁移后 |
| --- | --- | --- |
| `CardDescription.svelte` | `cardTextToHtml()` → `GOLD_SPAN` 正则切段 → 逐段查 4 张表 | `<GameText>`，一整条 AST；`interactive={variant === 'article'}` |
| `CardThumb.svelte` | `cardTextToHtml()` → `{@html}`，本就无实体链接 | `<GameText>`，`sizeUnit: 'cqw'` + `inCombat` + `matchEntities: false` |
| `CollectionView.svelte` | `collectionTextToHtml()` → `{@html}` | `<GameText options={{ mode: 'collection', energyIconSrc }}>` |

- `CardDescription` 删除了 `GOLD_SPAN`、`segments`、`termSegment()`、`escapeText()` /
  `decodeText()`，以及 `WIKI_ENTRIES` / `termIndex()` / `bbcodeToHtml` / `cardTextToHtml`
  四个依赖。关键词行改为 `<GameText options={{ matchEntities: false }}>`，保持原来「纯金色、不链接」。
- `CardThumb` 整体位于 `<a>` 内，必须 `matchEntities: false`，否则会产出嵌套链接。
- `CollectionView` 的图标类名由 `sts-collection-icon` 变为统一的 `sts-energy-icon`，
  样式选择器已同步；`collectionTextToHtml()` 因此不再被生产组件引用。
- 新增 `GameTextOptions.interactive`（保留实体节点、不出 `<a>`）与
  `GameTextOptions.matchEntities`（完全跳过实体匹配）。
- 新增 `CardDescription.svelte.spec.ts`（4 例）：金色实体链接、变量求值、face 变体不可点、
  关键词行不链接、未知标签与 `<` 不破坏输出。

**保留不动**（Wiki 专用语义，强行合并会改变现有行为）：

- `WikiText.svelte` / `WikiInline.svelte`：Wiki Markdown 的 `StS2 Icon X.png`、`§ICON_X§`、
  `(10)` 升级数语法，与游戏 BBCode 是两套记号。
- `RichText.svelte`：`termIndex()/termPattern()` 是**精选词条**（`GLOSSARY_LINKS` 的名词 + 别名，
  剔除 `enemyOnly`），用于 Wiki 摘要的「全量高亮 + 虚线下划线 + 数字加粗」，
  与「只匹配金色节点」的游戏文本语义不同，数据源也不同。
- `cardTextToHtml()` / `collectionTextToHtml()` 保留为纯字符串 API（`*ToPlain()` 仍在用）。

**顺带修复**：`entities.ts` 中药水实体的 href 由 `/relics#potion-<id>` 改为
`/potions#potion-<id>`（列表页按 `kind` 生成锚点，原写法指向了不存在的 id，
迁移后更多实体变成链接才在预渲染时暴露）。

## 10. 验证与剩余工作

- `pnpm exec vitest run`：23 文件 / 156 测试全过（含 client chromium 组件测试）。
- `pnpm check`：0 errors / 0 warnings；`CardDescription` / `CardThumb` / `GameText`
  经 svelte-autofixer 无建议。
- `pnpm build` 通过（预渲染正常，仅 7 个缺失图片资源 404，与本次重构无关）。
- `enemyOnly` 全部启用，不参与匹配过滤（`EntityNameEntry.enemyOnly` 仅作数据标记）。

