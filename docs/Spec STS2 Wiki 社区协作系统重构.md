# Spec: STS2 Wiki 社区协作系统重构

## 1. 任务目标

将现有 STS2 Wiki 从以静态游戏资料展示为主的 SvelteKit 项目，升级为支持 Mod 独立内容管理和社区协作的 Wiki 系统。

用户可以在 Wiki 页面中独立编辑某个内容区块、提交修改、查看编辑历史、参与评论。

Mod 作者可以随 Mod 提供初始 Wiki 内容。Mod 自带内容导入系统后，由 Wiki 数据库统一管理正式内容，社区可以继续编辑、补充和维护这些内容。

采用以下核心规则：

1. Wiki 页面由多个独立编辑区块组成，采用 Section Editing，不采用整页编辑。
2. 每个 Mod 可以拥有独立的 Wiki 页面和初始 Markdown 内容。
3. Mod 自带 Markdown 作为 Wiki 内容的初始来源，导入 D1 后统一管理。
4. 所有正式发布的 Wiki 内容统一从 D1 获取，不在运行时混合读取 Markdown 文件和 D1 内容。
5. 普通用户（member）提交修改后进入审核队列，不直接改变正式内容。
6. 可信贡献者（trusted）可以直接发布修改，无须人工审核。
7. 审核人员（moderator）负责审核普通用户的修改。
8. 管理员（admin）拥有完整管理权限。
9. 所有正式发布的修改都生成独立 Revision，不能覆盖已有历史版本。
10. 支持历史版本查看、差异比较和版本恢复。
11. 支持页面评论、区块评论和评论回复。
12. 游戏原始数据与 Wiki 内容完全分离。
13. Mod 原始 Wiki 内容与社区编辑后的正式 Wiki 内容分离，但通过来源记录关联。
14. 使用 SSG + SSR 混合渲染，部署在 Cloudflare Workers。

本任务是完整的架构和功能重构，不只是编写设计文档。需要检查现有项目后，按照实际代码结构实施。

## 2. 执行原则

### 2.1 先分析，再实施

在修改代码之前，全面检查现有项目：

- package.json 和 pnpm-lock.yaml。
- SvelteKit、Svelte、adapter 和 Vite 版本。
- 当前 Cloudflare 部署配置。
- 路由结构和页面渲染方式。
- 游戏数据 Manifest、cards.json、relics.json 等数据结构。
- 现有 Mod 目录结构及资源加载方式。
- 是否已有 Mod 注册、识别和元数据管理机制。
- 现有 Wiki 页面组件和内容渲染逻辑。
- 已有的 Wiki Entity、图标、卡牌引用等特殊 Markdown 渲染能力。
- 当前 UI 组件库和设计规范。
- 现有身份认证、用户数据和权限系统。
- 现有数据库、迁移系统和测试配置。

重点检查：

- 当前 Mod ID 的定义和唯一性。
- 当前 Mod 资源是否通过 import.meta.glob 管理。
- 现有项目是否已经有适合 Wiki 初始内容的目录约定。
- Markdown 是否已有解析、Token 转换和渲染实现。
- 当前 SSG 是否能够枚举 Mod 提供的 Wiki 页面。
- Cloudflare D1 的当前绑定、Migration 和本地开发方式。

根据实际代码确认需要修改的部分，不要假定现有项目与设计方案完全一致。

先输出：

1. 当前架构分析。
2. 需要修改的模块。
3. 目标架构及其与现有架构的差异。
4. 数据库迁移方案。
5. Mod Wiki 内容源与同步方案。
6. 分阶段实施计划。

完成分析后继续实施，不要只停留在计划阶段。

如果发现原方案与当前 SvelteKit、Cloudflare 或现有依赖存在兼容性问题，应优先采用当前版本官方支持的实现，并记录调整理由。

### 2.2 代码规范

- 使用 Svelte 5 Runes 语法，不要使用 Svelte 4 旧式响应式写法。
- 保持 TypeScript 类型安全。
- 遵循现有项目的 Tailwind CSS、Skeleton 和 Bits UI 使用规范。
- 保持现有 Paraglide 国际化体系。
- 不要引入与现有依赖功能重复的库。
- 注释使用英文，只为不明显的实现提供必要说明。
- 不要为了抽象而抽象，优先采用清晰、可测试的模块化设计。
- 不要重写与本次任务无关的功能。
- 保留现有游戏数据和 Wiki 页面表现。
- 不要为了实现 Mod Wiki 导入而破坏现有 Mod 资源加载方式。
- 不要将静态 Markdown 文件当作社区 Wiki 的运行时数据源。

## 3. 目标技术架构

采用单体 SvelteKit 全栈架构，不额外拆分独立 API 项目。

| 模块     | 技术                               |
| -------- | ---------------------------------- |
| 前端     | SvelteKit + Svelte 5               |
| 静态页面 | SvelteKit Prerender                |
| 动态页面 | SvelteKit SSR                      |
| API      | SvelteKit Server Routes            |
| 数据库   | Cloudflare D1                      |
| 文件存储 | Cloudflare R2（按实际需求实现）    |
| 部署     | Cloudflare Workers + Static Assets |
| 数据迁移 | Wrangler D1 Migrations             |
| 测试     | 沿用现有 Vitest / Playwright 配置  |

### 3.1 混合渲染

根据路由职责选择渲染模式。

**SSG：**

- 首页。
- 卡牌列表。
- 遗物列表。
- 药水列表。
- 角色列表。
- 其他不依赖用户实时数据的索引页面。

**SSR：**

- 卡牌详情页。
- 遗物详情页。
- 角色详情页。
- Mod Wiki 页面。
- 动态 Wiki 页面。
- 编辑历史页面。
- 用户资料页面。
- 审核管理页面。

卡牌、遗物、角色及 Mod Wiki 详情页面需要在服务端读取 D1 中最新的正式 Wiki 内容，使用户修改发布后，后续请求能够获取最新内容。

评论可以通过客户端调用 API 分页加载。

注意：

- 不要在根布局上全局启用 prerender。
- 只在明确需要静态生成的路由开启 prerender。
- 依赖 D1、Cookie 或用户身份的页面不得被静态预渲染。
- 静态生成过程中不得依赖 Cloudflare 运行时数据库连接。
- 不要为了支持用户编辑而将整个项目改成 SSR。
- 不要假设所有 Mod Wiki 页面都必须静态生成。
- 如果 Mod Wiki 页面需要 SSG，必须能够在构建阶段从 Mod 内容清单中枚举页面路径，并确保静态生成内容与动态 D1 内容之间不存在不一致。

### 3.2 Cloudflare 部署

使用当前版本兼容的 `@sveltejs/adapter-cloudflare`。

部署目标为 Cloudflare Workers + Static Assets。

检查并完善：

- SvelteKit adapter 配置。
- wrangler.jsonc。
- D1 数据库绑定。
- R2 绑定（需要时）。
- Cloudflare 环境类型生成。
- 本地开发与预览配置。
- Production / Preview 环境配置。
- 数据库 Migration 执行流程。

不要将 Cloudflare Pages Functions 与 Workers Static Assets 两种部署模式混合配置。

如果现有项目已经有可用的 Cloudflare 部署配置，应优先在原有基础上调整。

## 4. 游戏数据与 Wiki 内容分离

这是必须保持的核心架构原则。

### 4.1 游戏原始数据

继续使用现有 JSON、Manifest 和游戏数据加载方式。

例如：

```
src/lib/data/
├── cards.json
├── powers.json
├── relics.json
├── potions.json
└── characters.json
```

游戏原始数据属于只读数据，社区用户不得直接修改。

例如：

- type
- rarity
- cost
- variables
- upgradedVariables
- keywords
- 游戏原始名称和描述
- 游戏实体之间的原始关联关系

这些内容继续使用现有 JSON、Manifest 和 Localization 管理，不迁移到 D1。

### 4.2 Wiki 内容分类

Wiki 内容分为两类来源，但使用同一套正式内容存储和 Revision 管理。

**Mod 自带 Wiki 内容：**

由 Mod 作者在项目中提供初始 Markdown 文件。

例如：

- 角色介绍。
- 卡牌效果解析。
- 遗物机制说明。
- 玩法攻略。
- 角色联动。
- 游戏机制说明。

这些文件只作为初始内容和后续上游更新来源。

初次导入后，正式内容进入 D1，并生成初始 Revision。

**社区 Wiki 内容：**

由用户通过 Wiki 编辑器创建或修改。

所有社区修改统一进入现有 Proposal / Revision 流程。

社区也可以为没有 Mod 初始内容的页面创建新的 Wiki 区块，但必须遵循区块创建权限和内容校验规则。

### 4.3 统一运行时内容源

运行时必须遵循：

```
游戏原始数据
JSON / Manifest / Localization
             │
             ▼
        游戏实体信息

Mod Wiki Markdown
       │
       ▼
 初始内容导入 / 更新同步
       │
       ▼
            D1
       │
       ▼
正式 Wiki 内容 / Revision
       │
       ▼
       Wiki 页面
```

页面运行时：

- 游戏数据从现有 JSON / Manifest 获取。
- Wiki 正式内容从 D1 获取。
- 不重复保存游戏原始数据。
- 不允许 Wiki 内容更新影响游戏原始数据。
- 不允许 Mod Markdown 在运行时覆盖 D1 中的正式内容。
- 不允许因为 Mod 文件发生变化而直接覆盖已有社区内容。

### 4.4 页面标识

使用稳定的实体标识：

```
card:Abrasive
card:Strike
relic:SomeRelic
character:NeroBride
```

Mod Wiki 页面需要额外关联 Mod ID。

建议使用以下逻辑标识：

```
mod:fgo:index
mod:fgo:character:NeroBride
mod:another-mod:mechanics:energy
```

具体数据库实现可以采用独立字段：

- mod_id
- entity_type
- entity_id
- slug

或者采用统一 page type。

不要使用可能变化的展示名称、文件路径或数组索引作为唯一页面标识。

文件路径可以作为内容来源定位信息，但不能作为 Wiki Page 的唯一身份。

同一个 Wiki Page 应当有稳定 ID，即使 Mod 作者调整 Markdown 文件路径，也不应该自动创建重复页面。

### 4.5 页面与 Mod 关联

Wiki Page 至少需要能够表达：

- 页面所属 Mod。
- 页面类型。
- 页面对应的游戏实体（如果有）。
- 页面稳定标识。
- 页面 URL slug。

对于游戏实体页面，保留 `entity_type + entity_id` 作为实体关联。

对于纯 Mod Wiki 页面，使用 `mod_id + slug` 或等价的稳定组合标识。

具体约束应结合现有路由和 Mod 注册方式确定。

## 5. Mod Wiki 内容源与同步机制

这是本次重构新增的核心模块。

### 5.1 Mod Wiki 目录约定

建议按 Mod 独立组织 Markdown：

```
src/lib/mods/
├── base/
│   └── wiki/
│       ├── index/
│       │   └── overview.md
│       └── mechanics/
│           └── energy/
│               ├── overview.md
│               └── strategy.md
│
├── fgo/
│   └── wiki/
│       └── characters/
│           └── nero/
│               ├── overview.md
│               ├── effect-analysis.md
│               └── strategy.md
│
└── another-mod/
    └── wiki/
        └── index/
            └── overview.md
```

以上只是建议结构，实施前必须检查当前项目的 Mod 目录组织方式。

如果已有 `src/lib/mods/{modId}` 资源组织规范，应沿用现有规范，不要为了 Wiki 单独引入另一套不一致的 Mod 资源结构。

每个 Markdown 文件对应一个 Wiki Section。

例如：

```
src/lib/mods/fgo/wiki/characters/nero/overview.md
src/lib/mods/fgo/wiki/characters/nero/effect-analysis.md
src/lib/mods/fgo/wiki/characters/nero/strategy.md
```

对应：

```
Mod ID: fgo
Page: character:NeroBride
Sections:
  - overview
  - effect-analysis
  - strategy
```

不要将一整篇 Markdown 文件解析成多个区块。

Markdown 文件与 Wiki Section 采用一对一映射，便于独立编辑、Revision 管理和更新检测。

### 5.2 Markdown 文件要求

Mod 自带 Wiki 内容使用 Markdown。

支持现有项目已有的 Wiki 特殊 Token 和实体引用语法。

必须保留：

- Wiki Entity。
- 卡牌引用。
- Power 图标。
- 遗物图标。
- 自定义文本解析。
- 现有 Wiki 专用 Markdown 渲染逻辑。

不要直接替换为无法兼容现有 Token 的普通 Markdown Renderer。

第一版：

- Markdown 作为主要内容格式。
- Table 可以使用独立结构化内容。
- Structured 内容使用 JSON 序列化存储。
- 不允许直接执行任意 HTML、Svelte 组件或脚本。
- 不需要为 Mod Markdown 创建独立的运行时渲染系统。

### 5.3 Markdown 导入

实现 Mod Wiki 初始内容导入机制。

导入时：

1. 扫描已注册 Mod 的 Wiki 内容目录。
2. 识别 Mod ID。
3. 根据约定解析 Page 和 Section。
4. 读取 Markdown 内容。
5. 校验文件路径、页面标识、区块 key 和内容格式。
6. 计算内容 Hash。
7. 检查 D1 中是否已有对应来源记录。
8. 创建或更新来源记录。
9. 对不存在的 Wiki Page 创建页面。
10. 对不存在的 Wiki Section 创建区块。
11. 为首次导入的区块创建初始正式 Revision。
12. 建立 Section 与内容来源之间的关联。

初始导入创建的 Revision 应标记为 Mod 来源。

导入过程必须具备幂等性：

- 相同内容重复导入不能重复创建 Revision。
- 不得重复创建相同页面和区块。
- 不得覆盖已有社区修改。
- 不得因为构建或部署而自动重复发布内容。
- 不得由普通页面请求触发写入 D1 的导入操作。

导入应使用独立脚本、管理命令或受权限保护的管理操作。

根据 Cloudflare D1 的运行环境，选择合适的导入执行方式。

### 5.4 内容来源追踪

必须能够追踪 Wiki Section 的原始 Markdown 来源。

建议增加 `wiki_section_sources` 表。

字段：

- id。
- section_id。
- source_type。
- source_path。
- source_hash。
- source_content。
- source_mod_version。
- last_synced_at。
- created_at。
- updated_at。

字段说明：

- section_id：对应的 Wiki Section。
- source_type：当前至少支持 mod。
- source_path：Mod Markdown 文件的相对路径。
- source_hash：最近一次成功同步的上游内容 Hash。
- source_content：最近一次成功同步的上游内容快照。
- source_mod_version：对应 Mod 版本。
- last_synced_at：最近一次成功同步时间。

约束：

- 一个 Wiki Section 可以没有来源记录，例如纯社区创建的区块。
- 第一版一个 Wiki Section 最多关联一个 Mod Markdown 来源。
- 同一来源不能重复关联多个 Section。
- 来源记录不等于正式 Wiki 内容。
- 修改来源记录不得直接修改正式 Revision。

`source_content` 必须保留最近一次成功同步的上游内容，以便后续进行更新对比。

如果考虑存储成本，可以评估使用独立来源快照表，但不能因此失去三方对比所需的基准内容。

### 5.5 Mod 更新检测

Mod 作者更新 Markdown 后，不能直接覆盖 D1 正式内容。

需要支持：

- 检测新增文件。
- 检测已存在文件的内容变化。
- 检测文件删除。
- 检测 Mod 版本变化。
- 检测页面或 Section 标识变化。

使用 Hash 判断上游内容是否发生变化。

更新检测应比较三个内容：

1. 上一次成功同步的上游内容（Base）。
2. D1 当前正式发布内容（Current）。
3. Mod 当前提供的新 Markdown（Incoming）。

根据比较结果处理：

**情况 A：D1 当前内容与 Base 相同，Incoming 已变化。**

说明社区没有修改过正式内容。

可以将 Incoming 作为新的 Mod 更新发布，创建新的正式 Revision。

**情况 B：Incoming 与 Base 相同。**

说明 Mod 作者没有修改该内容。

跳过同步，不创建 Revision。

**情况 C：D1 当前内容与 Base 不同，Incoming 也与 Base 不同。**

说明社区和 Mod 作者都修改了内容。

不能自动覆盖。

创建上游更新候选，展示 Base、Current、Incoming 三者差异，由管理员或有权限的人员处理。

**情况 D：D1 当前内容与 Base 不同，但 Incoming 与 Current 相同。**

说明当前正式内容已经与新上游内容一致。

可以更新来源同步状态，不需要重复创建 Revision。

**情况 E：Mod 删除了原始 Markdown 文件。**

不能直接删除正式 Wiki Section 或 Revision。

应将来源标记为已删除或待处理，保留正式内容，并由管理员决定是否解除来源关联、归档区块或保留内容。

### 5.6 上游更新处理

新增 Mod 上游更新候选机制。

可以使用独立的 `wiki_source_updates` 表，也可以在确认业务复杂度后复用 Proposal 表。

优先采用职责清晰、状态明确的设计，不要为了复用而混淆普通用户编辑和 Mod 上游更新。

上游更新至少需要记录：

- section_id。
- source_id。
- base_content。
- current_content。
- incoming_content。
- base_hash。
- incoming_hash。
- status。
- reviewed_by。
- review_note。
- created_at。
- reviewed_at。

状态至少包括：

- pending。
- approved。
- rejected。
- conflict。
- withdrawn。

处理规则：

- 自动无冲突更新可以直接发布新的 Revision。
- 有冲突的更新需要人工处理。
- 人工处理后仍然必须生成新的正式 Revision。
- 不得修改已有 Revision。
- 更新来源快照必须在正式同步成功后进行。
- 拒绝更新时不能改变当前正式 Wiki 内容。
- 重复处理同一更新不得产生重复 Revision。

第一版不要求实现复杂的自动三方合并。

可以先提供三栏内容对比：

- 上游基准内容。
- 当前正式内容。
- Mod 新内容。

由管理员选择保留、合并或拒绝。

### 5.7 来源更新权限

Mod 上游更新属于系统内容维护操作。

建议：

- 普通 member 不允许处理上游更新。
- trusted 不自动获得上游更新管理权限。
- moderator 可以查看上游更新并提出处理意见。
- admin 可以批准、拒绝、合并和处理来源变更。

如果现有权限系统需要更细粒度权限，应明确增加独立权限，而不是简单复用 trusted。

### 5.8 导入与同步边界

必须明确：

- Mod Markdown 是内容源，不是正式内容数据库。
- D1 是正式 Wiki 内容的唯一运行时来源。
- 初始导入和上游更新同步是独立的后台管理操作。
- 页面 SSR 不允许自动执行导入。
- 普通 GitHub Actions 构建不得无条件覆盖 D1。
- Mod 更新同步必须可重复执行且具备幂等性。
- 同步失败不能破坏现有正式内容。
- 上游内容变化必须保留可审计记录。

## 6. 数据库设计

建立以下核心数据表：

1. users
2. wiki_pages
3. wiki_sections
4. wiki_revisions
5. wiki_edit_proposals
6. wiki_section_sources
7. wiki_source_updates
8. comments
9. wiki_audit_logs

如果现有项目已经有适合的表或等价实现，可以调整命名，但必须完整覆盖上述职责。

使用 D1 / SQLite 兼容的 SQL，启用适当的外键约束和索引。

### 6.1 users

字段：

- id：用户主键。
- auth_subject：外部认证系统的用户标识，唯一。
- username：用户名，唯一。
- role：member / trusted / moderator / admin。
- status：active / suspended。
- created_at。

认证部分优先复用现有认证体系。

如果现有项目没有认证体系，不要自行实现不安全的密码存储或伪造登录用户。先检查 Cloudflare 兼容的认证方案，设计可替换的认证接口，明确配置要求。

所有写操作必须在服务端验证用户身份。

### 6.2 wiki_pages

字段：

- id。
- mod_id，可为空。
- entity_type，可为空。
- entity_id，可为空。
- slug。
- page_type。
- created_at。

约束：

- 游戏实体页面需要稳定的 entity_type + entity_id。
- Mod Wiki 页面需要稳定的 mod_id + slug。
- 不允许使用展示名称或数组索引作为唯一标识。
- 具体唯一约束应根据 D1 / SQLite 支持的部分索引等能力设计。
- 不同 Mod 可以拥有相同 slug。
- 页面与 Mod 的关联必须明确。

### 6.3 wiki_sections

字段：

- id。
- page_id。
- section_key。
- content_type：markdown / table / structured。
- sort_order。
- current_revision_id。
- version。
- updated_at。

约束：

- 同一页面内 section_key 唯一。
- version 从 0 开始。
- current_revision_id 指向当前正式 Revision。
- 区块独立管理版本。
- 第一版不开放普通用户创建、删除或修改区块定义的权限。

区块 key 应保持稳定，例如：

```
overview
effect-analysis
mechanics
strategy
synergies
history
```

### 6.4 wiki_revisions

字段：

- id。
- section_id。
- revision_no。
- parent_revision_id。
- content。
- summary。
- editor_id，可为空。
- source_type。
- source_reference，可为空。
- created_at。

source_type 建议支持：

- mod_seed。
- mod_update。
- community。
- moderation。
- rollback。

字段说明：

- mod_seed：Mod 初始内容导入。
- mod_update：Mod 上游更新发布。
- community：可信贡献者直接发布。
- moderation：普通用户 Proposal 审核通过。
- rollback：恢复历史版本。

source_reference 用于关联 Mod 来源或上游更新记录。

约束：

- 同一个区块内 revision_no 唯一。
- 只保存正式发布的内容。
- 已有 Revision 不得直接覆盖。
- parent_revision_id 表示发布时基于的上一正式版本。
- 正式 Revision 使用完整内容快照。

### 6.5 wiki_edit_proposals

字段：

- id。
- section_id。
- base_revision_id。
- base_version。
- proposed_content。
- summary。
- submitted_by。
- status：pending / approved / rejected / conflict / withdrawn。
- reviewed_by。
- review_note。
- created_at。
- reviewed_at。
- published_revision_id。

约束：

- Proposal 不属于正式 Revision。
- 普通用户提交后不修改当前正式内容。
- 审核通过后生成新的正式 Revision。
- 审核拒绝不影响当前正式内容。
- 记录最终发布的 Revision ID。
- 支持用户撤回尚未处理的 Proposal。

### 6.6 wiki_section_sources

字段：

- id。
- section_id。
- source_type。
- source_path。
- source_hash。
- source_content。
- source_mod_version。
- last_synced_at。
- created_at。
- updated_at。

约束：

- 一个 Section 最多关联一个 Mod Markdown 来源。
- source_path 使用项目内相对路径，不使用机器绝对路径。
- source_hash 表示最近一次成功同步的上游内容。
- source_content 保存对应的上游内容快照。
- 不允许将其当作正式 Wiki 内容直接渲染。

### 6.7 wiki_source_updates

字段：

- id。
- source_id。
- section_id。
- base_content。
- current_content。
- incoming_content。
- base_hash。
- incoming_hash。
- status：pending / approved / rejected / conflict / withdrawn。
- reviewed_by。
- review_note。
- created_at。
- reviewed_at。
- published_revision_id。

用途：

管理 Mod 上游内容更新，尤其是与社区正式内容发生冲突的情况。

约束：

- 不直接修改正式 Revision。
- 批准后创建新的正式 Revision。
- 处理完成后记录发布的 Revision ID。
- 重复批准不得重复创建 Revision。
- 更新来源快照必须与正式发布结果保持一致。

如果实现中选择将无冲突更新直接发布，可以不创建长期保留的待审核记录，但必须写入 Audit Log，并更新来源快照。

### 6.8 comments

字段：

- id。
- page_id。
- section_id，可为空。
- parent_id，可为空。
- author_id。
- content。
- status：visible / hidden / deleted。
- created_at。
- updated_at。

规则：

- section_id 为空代表页面评论。
- section_id 不为空代表区块评论。
- parent_id 用于回复。
- 第一版限制为一层回复，避免复杂的无限嵌套。
- 回复必须属于同一页面及区块。
- 支持软删除和隐藏。
- 不要将评论内容保存在 Wiki Revision 中。

### 6.9 wiki_audit_logs

字段：

- id。
- actor_id，可为空。
- action。
- target_type。
- target_id。
- metadata_json。
- created_at。

记录以下操作：

- 审核通过。
- 审核拒绝。
- 版本恢复。
- 用户权限变更。
- 用户封禁。
- 评论隐藏或删除。
- Wiki 区块锁定或解锁。
- Mod 初始内容导入。
- Mod 上游更新检测。
- Mod 上游更新发布。
- Mod 上游更新拒绝。
- Mod 来源关联或解除。
- 内容同步失败。

### 6.10 索引

根据查询场景建立索引：

- wiki_sections(page_id, sort_order)。
- wiki_revisions(section_id, revision_no)。
- wiki_edit_proposals(status, created_at)。
- wiki_source_updates(status, created_at)。
- wiki_section_sources(section_id)。
- comments(page_id, created_at)。
- comments(section_id, created_at)。
- comments(parent_id, created_at)。
- wiki_audit_logs(target_type, target_id, created_at)。

需要检查外键、唯一约束和索引在 SQLite / D1 中的实际兼容性。

## 7. 编辑与审核业务逻辑

统一采用 Section Editing。

用户点击某个区块的编辑按钮，只进入当前区块的编辑模式，不影响其他区块。

### 7.1 普通用户 member

流程：

1. 用户登录。
2. 加载当前正式 Revision。
3. 修改内容。
4. 填写修改摘要。
5. 提交 Proposal。
6. Proposal 状态变为 pending。
7. 当前正式内容保持不变。
8. 审核人员处理 Proposal。

普通用户不能直接更新 current_revision_id。

### 7.2 可信贡献者 trusted

流程：

1. 用户登录。
2. 加载当前正式 Revision。
3. 修改内容。
4. 填写修改摘要。
5. 提交修改。
6. 服务端验证 trusted 权限及版本号。
7. 创建新的正式 Revision。
8. 原子更新 current_revision_id 和 version。
9. 记录 Audit Log。

trusted 可以跳过审核，但不能跳过权限验证、内容校验和版本管理。

### 7.3 moderator

具有：

- 查看待审核修改。
- 比较修改差异。
- 审核通过。
- 审核拒绝。
- 添加审核意见。
- 查看相关版本历史。
- 查看 Mod 上游更新。
- 对上游冲突提出处理意见。

mod­erator 可以直接发布普通用户修改，但不能随意修改管理员权限或执行管理员专属操作。

### 7.4 admin

具有完整管理权限：

- 用户角色管理。
- 用户封禁及解封。
- 审核。
- 内容管理。
- 版本恢复。
- 评论管理。
- Wiki 区块管理。
- Mod 来源管理。
- Mod 上游更新处理。
- 来源关联和解除。
- 处理来源同步冲突。

普通用户不得自行修改自己的 role。

所有权限必须在服务端执行，不能仅依赖前端隐藏按钮。

### 7.5 审核冲突

Proposal 保存：

- base_revision_id。
- base_version。

审批时必须再次检查当前区块版本。

如果提交 Proposal 后，当前区块已经被其他用户发布新版本：

- 不得直接覆盖新版本。
- 将 Proposal 标记为 conflict。
- 保留原始提交内容。
- 提供审核人员重新比较和处理的能力。
- 处理冲突时必须基于最新正式版本创建新的 Revision。

禁止静默覆盖并发修改。

## 8. Revision 版本管理

实现以下功能。

### 8.1 历史记录

- 查看某个区块的所有正式版本。
- 显示版本号、修改者、修改时间、修改摘要和来源类型。
- 按时间倒序展示。
- 支持分页。

### 8.2 版本差异

支持选择两个正式版本进行比较。

显示：

- 新增内容。
- 删除内容。
- 修改内容。

Markdown 内容优先使用合适的文本 diff 实现，不需要第一版就实现复杂的可视化编辑器。

### 8.3 版本恢复

恢复旧版本时：

1. 读取目标历史 Revision。
2. 将目标 Revision 的内容复制为新 Revision。
3. parent_revision_id 指向当前正式版本。
4. summary 记录恢复来源。
5. 更新当前区块版本。
6. 记录 Audit Log。

禁止直接修改历史记录或将旧 Revision 重新设置为当前版本而不生成新 Revision。

### 8.4 来源追踪

历史版本需要明确显示内容来源：

- Mod 初始内容。
- Mod 上游更新。
- 社区直接发布。
- 普通用户审核通过。
- 管理员恢复。

来源记录应能够关联到对应的 Mod 和上游版本。

## 9. 评论系统

实现：

- 页面评论。
- 区块评论。
- 评论回复。
- 评论修改。
- 评论删除。
- 管理员隐藏评论。
- 评论分页。
- 评论作者信息。
- 评论时间。

评论与 Wiki 编辑历史完全独立。

普通用户必须登录后才能发表评论。

需要对评论频率、长度和内容进行服务端限制。

评论删除采用软删除，保留必要的操作记录。

第一版不需要实现实时聊天、WebSocket、点赞或复杂通知系统。

## 10. API 设计

使用 SvelteKit Server Routes。

建议接口：

| API                                    | Method | 说明               |
| -------------------------------------- | ------ | ------------------ |
| /api/wiki/sections//edits              | POST   | 提交区块编辑       |
| /api/wiki/sections//revisions          | GET    | 获取版本历史       |
| /api/wiki/sections//revert             | POST   | 恢复历史版本       |
| /api/wiki/proposals                    | GET    | 获取审核队列       |
| /api/wiki/proposals//review            | POST   | 审核 Proposal      |
| /api/wiki/pages//comments              | GET    | 获取页面评论       |
| /api/wiki/pages//comments              | POST   | 发表评论           |
| /api/comments/                         | PATCH  | 修改评论           |
| /api/comments/                         | DELETE | 删除评论           |
| /api/admin/wiki/sources                | GET    | 查看 Mod 内容来源  |
| /api/admin/wiki/sources/sync           | POST   | 执行来源检测或同步 |
| /api/admin/wiki/source-updates         | GET    | 获取上游更新列表   |
| /api/admin/wiki/source-updates//review | POST   | 处理上游更新       |

根据实际业务需要调整路由，但不要将所有业务逻辑直接写进 +server.ts。

Mod 来源同步 API 必须经过严格管理员权限验证。

如果采用独立导入脚本，则可以不暴露同步 API，但必须保留可执行的导入和同步能力。

API 层只负责：

- 请求解析。
- 参数校验。
- 身份验证。
- 权限检查。
- 调用 Service。
- 返回统一响应。

## 11. 服务端模块划分

建议建立：

```
src/lib/server/
├── auth/
│   ├── session.ts
│   └── permissions.ts
│
└── wiki/
    ├── repository.ts
    ├── page-service.ts
    ├── section-service.ts
    ├── revision-service.ts
    ├── proposal-service.ts
    ├── source-service.ts
    ├── source-sync-service.ts
    ├── comment-service.ts
    ├── audit-service.ts
    └── validation.ts
```

职责：

- repository：只处理 D1 数据读写。
- page-service：页面查询及游戏实体关联。
- section-service：区块查询与更新。
- revision-service：Revision 创建、查询、比较、恢复。
- proposal-service：修改提交、审核和冲突处理。
- source-service：Mod 来源记录查询和维护。
- source-sync-service：Mod Markdown 导入、Hash 检测、上游更新比较和同步。
- comment-service：评论及回复。
- audit-service：操作审计。
- permissions：统一角色与权限判定。
- validation：内容结构及请求校验。

可以根据现有代码结构调整文件拆分，但必须保持职责边界。

不要让 Repository 承担业务规则，也不要在前端直接操作 D1。

Mod 文件扫描和解析应与 D1 写入逻辑分离，便于测试和重复执行。

## 12. 前端组件设计

建议建立：

```
src/lib/components/wiki/
├── WikiSection.svelte
├── WikiSectionRenderer.svelte
├── WikiSectionEditor.svelte
├── WikiSectionActions.svelte
│
├── editors/
│   ├── MarkdownEditor.svelte
│   ├── TableEditor.svelte
│   └── StructuredEditor.svelte
│
├── history/
│   ├── RevisionHistory.svelte
│   └── RevisionDiff.svelte
│
├── comments/
│   ├── CommentList.svelte
│   ├── CommentItem.svelte
│   └── CommentForm.svelte
│
├── moderation/
│   ├── ProposalList.svelte
│   └── ProposalReview.svelte
│
└── sources/
    ├── SourceUpdateList.svelte
    └── SourceUpdateReview.svelte
```

### WikiSection

统一负责：

- 查看模式。
- 编辑模式。
- 保存。
- 取消。
- 最后修改者。
- 最后修改时间。
- 当前版本。
- 审核状态。
- 版本历史入口。
- 评论入口。

### WikiSectionRenderer

根据 content_type 选择对应内容渲染器。

必须保留项目目前已有的 Wiki 内容渲染能力，例如实体引用、卡牌图标、Power 图标和自定义文本解析。

不要将已有的 Wiki 专用 Markdown / Token 渲染机制简单替换成普通 Markdown Renderer。

### WikiSectionEditor

根据 content_type 选择编辑器：

- markdown：Markdown 编辑器。
- table：表格编辑器。
- structured：结构化表单编辑器。

第一版优先实现 Markdown Editor，其他编辑器在现有业务确实需要时实现，不要为了扩展性提前引入复杂编辑器框架。

编辑状态和正式内容必须分离。取消编辑不能改变正式内容。

普通用户提交成功后显示待审核状态，而不是显示为已经正式发布。

可信贡献者发布成功后更新当前区块内容和版本信息。

### Mod 来源管理界面

管理员需要能够：

- 查看已注册 Mod 的内容来源。
- 查看来源文件路径。
- 查看最近同步时间。
- 查看 Mod 来源版本。
- 检查内容 Hash。
- 查看待处理上游更新。
- 比较 Base、Current 和 Incoming。
- 批准、拒绝或手动处理更新。
- 查看同步失败记录。

第一版可以使用简单的管理列表和 Diff 页面，不需要实现复杂的 Git 管理界面。

## 13. 缓存策略

第一版采用保守的缓存策略。

- SSG 索引页面：使用 Cloudflare CDN。
- 动态详情页面：SSR，读取最新正式 Wiki 内容。
- 编辑历史：服务端查询，可按需要短时间缓存。
- 评论：API 分页加载。
- 用户个人资料：避免公共缓存。
- 静态图片和资源：使用 Cloudflare CDN。

第一版不要引入复杂的缓存失效系统。

尤其不要让用户修改正式内容后还必须触发 GitHub Actions 重新构建才能看到最新内容。

Mod Markdown 初始来源的导入与同步不应依赖每次页面请求。

Mod 内容发生变化时，通过独立的导入或同步流程更新 D1。

## 14. 安全要求

必须实现：

1. 所有写操作在服务端验证身份。
2. 所有权限判断在服务端完成。
3. 不信任前端传入的角色信息。
4. 使用乐观锁处理并发编辑。
5. 防止 CSRF 和跨站请求伪造。
6. 防止 Markdown / HTML XSS。
7. 对所有输入进行服务端校验。
8. 限制评论和编辑内容长度。
9. 限制接口请求频率。
10. 防止用户修改他人的评论。
11. 防止回复跨页面或跨区块。
12. 禁止普通用户修改角色和审核状态。
13. 历史 Revision 不允许被普通业务操作删除。
14. 审核和直接发布必须有审计记录。
15. Mod Markdown 导入时校验路径，防止路径穿越。
16. Mod 内容来源不能执行任意脚本或 HTML。
17. 来源同步不能覆盖社区正式内容。
18. 同步操作必须具备幂等性。
19. 来源更新失败不能破坏当前正式内容。
20. 不允许未经授权的请求触发 Mod 来源同步。

不要将用户提交的任意 HTML、Svelte 组件或脚本作为 Wiki 内容直接执行。

结构化内容必须进行服务端 Schema 校验。

### 并发与事务

Revision 创建、Section 当前版本更新、Proposal 状态更新、来源同步状态更新必须保证一致性。

使用 D1 支持的事务或 batch 机制。

注意：条件 UPDATE 影响 0 行不一定自动回滚整个事务，因此不能仅凭 D1 batch 没有抛出异常就认为版本更新成功。

必须检查影响行数，并保证：

- 版本检查失败时，不产生正式 Revision。
- Revision 创建失败时，不更新当前区块版本。
- Proposal 审核失败时，不错误地标记为已通过。
- 上游更新发布失败时，不更新来源快照。
- 来源快照更新失败时，不应出现正式内容和来源同步状态不一致。
- 并发修改不会覆盖其他用户的正式内容。
- 重复导入和重复审核不会产生重复 Revision。

需要根据当前 D1 支持的事务能力设计可靠的原子操作。不要假设多个独立请求可以天然组成事务。

## 15. 测试要求

沿用现有 Vitest / Playwright 配置，不要重复安装测试框架。

至少覆盖以下场景。

### 15.1 数据层

- 创建 Wiki Page。
- 创建 Wiki Section。
- 创建正式 Revision。
- 查询当前 Revision。
- 查询历史版本。
- 创建 Proposal。
- 查询待审核 Proposal。
- 评论和回复关联正确。
- 创建 Mod 内容来源。
- 查询 Mod 内容来源。
- 创建上游更新候选。
- 更新来源同步状态。

### 15.2 权限

- 未登录用户不能编辑。
- member 只能提交 Proposal。
- member 不能直接发布。
- trusted 可以直接发布。
- moderator 可以审核。
- admin 可以管理角色。
- admin 可以处理 Mod 上游更新。
- trusted 不会自动获得 Mod 来源管理权限。
- suspended 用户不能进行写操作。
- 普通用户不能修改自己的角色。
- 未授权用户不能执行来源同步。

### 15.3 审核

- 审核通过后创建正式 Revision。
- 审核拒绝后正式内容不变。
- 审核完成后 Proposal 状态正确。
- 重复审核不能产生重复 Revision。
- 基础版本过期时进入 conflict。
- 冲突处理不能覆盖更新后的正式版本。

### 15.4 Revision

- 每次正式发布都创建新 Revision。
- 历史 Revision 不被覆盖。
- 恢复旧版本时创建新 Revision。
- Revision 父子关系正确。
- 并发更新时只有一个提交成功。
- 来源类型和来源关联正确。

### 15.5 Mod 内容导入

- 能扫描多个 Mod 的 Wiki Markdown。
- 不同 Mod 的相同文件名不会产生冲突。
- 正确识别 Page 和 Section。
- 首次导入能够创建页面、区块和初始 Revision。
- 重复导入相同内容不会重复创建 Revision。
- 新增 Markdown 文件能够创建新 Section。
- 相同来源文件内容变化能够检测到。
- 社区未修改时能够安全发布上游更新。
- 社区和 Mod 同时修改时进入冲突处理。
- Incoming 与 Current 相同时不产生重复 Revision。
- 删除来源文件不会直接删除正式内容。
- 导入失败不会破坏现有正式内容。
- 非法路径和无效内容会被拒绝。

### 15.6 评论

- 页面评论正常。
- 区块评论正常。
- 评论回复正常。
- 不允许跨页面、跨区块回复。
- 用户不能随意修改其他人的评论。
- 隐藏和删除状态正确。

### 15.7 前端

- 区块独立进入编辑模式。
- 取消编辑能够恢复原内容。
- 保存期间防止重复提交。
- 普通用户看到待审核状态。
- 可信贡献者看到正式发布结果。
- 版本历史和差异对比正常。
- Mod 来源更新列表正常。
- 上游冲突对比正常。
- 现有 Wiki Token 和 Entity 渲染不受影响。

### 15.8 构建

- SvelteKit build 成功。
- Prerender 路由正常生成。
- SSR 动态路由正常。
- Cloudflare Worker 本地预览正常。
- D1 Migration 可以正常执行。
- Mod Markdown 扫描与导入脚本正常执行。

## 16. 实施阶段

按照以下顺序实施。

### Phase 1：架构和数据库基础

- 检查当前项目。
- 确定 Cloudflare Workers 部署方案。
- 调整 SvelteKit adapter。
- 配置 Wrangler 和 D1。
- 建立 SQL Migration。
- 实现用户、Wiki Page、Section、Revision 数据层。
- 实现 Mod 与 Wiki Page 的关联。
- 实现服务端身份与权限抽象。

### Phase 2：Mod Wiki 内容源

- 确定现有 Mod 目录与 Wiki Markdown 目录规范。
- 实现 Mod Wiki 文件扫描。
- 实现 Markdown 文件解析和路径映射。
- 实现来源 Hash 计算。
- 实现首次内容导入。
- 实现幂等导入。
- 实现来源记录。
- 实现 Mod 更新检测。
- 实现 Base / Current / Incoming 对比。
- 实现上游更新候选和冲突处理。
- 实现上游更新 Revision 发布。
- 实现来源同步审计记录。

### Phase 3：Wiki 编辑与审核

- 实现 WikiSection 通用容器。
- 实现 Markdown 编辑器。
- 实现 member Proposal 提交。
- 实现 trusted 直接发布。
- 实现 moderator 审核。
- 实现乐观锁和冲突检测。
- 实现审计记录。

### Phase 4：版本管理

- 实现历史版本列表。
- 实现版本差异比较。
- 实现历史版本恢复。
- 完善冲突处理。
- 完善并发测试。

### Phase 5：评论系统

- 页面评论。
- 区块评论。
- 评论回复。
- 编辑和删除。
- 管理员隐藏。
- 分页和限制策略。

### Phase 6：页面整合和部署

- 将 Wiki Section 接入现有卡牌、遗物、角色详情页。
- 接入 Mod Wiki 页面。
- 确保游戏原始数据和 Wiki 内容正确组合。
- 实现 SSR 动态详情页面。
- 保留 SSG 索引页面。
- 完成 Cloudflare Worker 部署配置。
- 完成全部测试。

## 17. 最终验收标准

完成后，必须满足以下要求：

- 现有游戏资料功能正常。
- 现有 Wiki 特殊文本和 Entity 渲染正常。
- 卡牌、遗物等原始游戏数据没有被迁移或破坏。
- 每个 Mod 可以独立组织自己的 Wiki Markdown 内容。
- Mod 初始 Wiki 内容可以导入 D1。
- Mod 自带内容导入后可以被社区编辑。
- 所有正式 Wiki 内容统一从 D1 获取。
- Mod Markdown 不会在运行时覆盖正式 Wiki 内容。
- 普通用户提交后必须等待审核。
- 可信贡献者可以直接发布。
- 审核通过后正式内容立即更新。
- 每次正式发布生成不可覆盖的 Revision。
- 支持历史查看、Diff 和恢复。
- Mod 来源更新能够被检测。
- Mod 更新不会覆盖社区修改。
- 上游冲突可以查看和人工处理。
- 支持页面评论和区块评论。
- 所有写操作经过服务端权限检查。
- 并发修改不会静默覆盖。
- SSG 和 SSR 路由按职责正常工作。
- 可以在 Cloudflare Workers 环境运行。
- 所有数据库变更有 Migration。
- 核心业务逻辑有自动化测试。
- 不存在硬编码模拟用户或绕过权限的测试实现进入生产环境。

## 18. 最终交付

完成代码后输出：

1. 原项目架构与目标架构的差异。
2. 新增和修改的文件清单。
3. 数据库 Schema 和 Migration 说明。
4. 用户权限与审核流程说明。
5. Mod Wiki Markdown 目录规范。
6. Mod 初始内容导入流程。
7. Mod 上游更新检测与冲突处理流程。
8. API 接口清单。
9. SSG / SSR 路由配置说明。
10. Cloudflare 部署及环境变量配置说明。
11. 测试执行结果。
12. 尚未实现的功能和已知问题。

不要仅输出伪代码或设计建议。需要实际修改代码、执行 Migration 检查、运行测试和构建。

遇到无法完成的外部认证配置或 Cloudflare 账号操作时，明确指出需要人工提供的配置，不得伪造成功结果。