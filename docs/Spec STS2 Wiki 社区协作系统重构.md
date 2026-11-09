# Spec: STS2 Wiki 社区协作系统重构

## 1. 任务目标

将现有 STS2 Wiki 从以静态游戏资料展示为主的 SvelteKit 项目，升级为支持社区协作的 Wiki 系统。

用户可以在 Wiki 页面中独立编辑某个内容区块、提交修改、查看编辑历史、参与评论。

采用以下核心规则：

1. Wiki 页面由多个独立编辑区块组成，采用 Section Editing，不采用整页编辑。
2. 普通用户（member）提交修改后进入审核队列，不直接改变正式内容。
3. 可信贡献者（trusted）可以直接发布修改，无须人工审核。
4. 审核人员（moderator）负责审核普通用户的修改。
5. 管理员（admin）拥有完整管理权限。
6. 所有正式发布的修改都生成独立 Revision，不能覆盖已有历史版本。
7. 支持历史版本查看、差异比较和版本恢复。
8. 支持页面评论、区块评论和评论回复。
9. 游戏原始数据与用户编辑的 Wiki 内容完全分离。
10. 使用 SSG + SSR 混合渲染，部署在 Cloudflare Workers。

本任务是完整的架构和功能重构，不只是编写设计文档。需要检查现有项目后，按照实际代码结构实施。

## 2. 执行原则

### 2.1 先分析，再实施

在修改代码之前，全面检查现有项目：

- package.json 和 pnpm-lock.yaml。
- SvelteKit、Svelte、adapter 和 Vite 版本。
- 当前 Cloudflare 部署配置。
- 路由结构和页面渲染方式。
- 游戏数据 Manifest、cards.json、relics.json 等数据结构。
- 现有 Wiki 页面组件和内容渲染逻辑。
- 已有的 Wiki Entity、图标、卡牌引用等特殊 Markdown 渲染能力。
- 当前 UI 组件库和设计规范。
- 现有身份认证、用户数据和权限系统。
- 现有数据库、迁移系统和测试配置。

根据实际代码确认需要修改的部分，不要假定现有项目与设计方案完全一致。

先输出：

1. 当前架构分析。
2. 需要修改的模块。
3. 目标架构及其与现有架构的差异。
4. 数据库迁移方案。
5. 分阶段实施计划。

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
- 动态 Wiki 页面。
- 编辑历史页面。
- 用户资料页面。
- 审核管理页面。

卡牌详情等页面需要在服务端读取 D1 中最新的正式 Wiki 内容，使用户修改发布后，后续请求能够立即获取最新内容。

评论可以通过客户端调用 API 分页加载。

注意：

- 不要在根布局上全局启用 prerender。
- 只在明确需要静态生成的路由开启 prerender。
- 依赖 D1、Cookie 或用户身份的页面不得被静态预渲染。
- 静态生成过程中不得依赖 Cloudflare 运行时数据库连接。
- 不要为了支持用户编辑而将整个项目改成 SSR。

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

### 4.2 Wiki 用户内容

使用 D1 保存社区贡献的内容。

例如：

```
Abrasive
├── 游戏原始数据
│   ├── type
│   ├── rarity
│   ├── cost
│   └── variables
│
└── Wiki 内容
    ├── description
    ├── mechanics
    ├── strategy
    └── history
```

页面加载时，根据稳定的实体标识组合两类数据：

- 游戏数据从现有 JSON / Manifest 获取。
- Wiki 内容从 D1 获取。
- 不重复保存游戏原始数据。
- 不允许 Wiki 内容更新影响游戏原始数据。

### 4.3 页面标识

使用稳定的实体标识：

```
card:Abrasive
card:Strike
relic:SomeRelic
character:NeroBride
```

数据库使用 `entity_type + entity_id` 关联游戏实体。

不要使用可能变化的展示名称或数组索引作为唯一标识。

## 5. 数据库设计

建立以下核心数据表：

1. users
2. wiki_pages
3. wiki_sections
4. wiki_revisions
5. wiki_edit_proposals
6. comments
7. wiki_audit_logs

使用 D1 / SQLite 兼容的 SQL，启用适当的外键约束和索引。

### 5.1 users

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

### 5.2 wiki_pages

字段：

- id。
- entity_type。
- entity_id。
- slug。
- created_at。

约束：

- entity_type + entity_id 唯一。
- slug 唯一。

### 5.3 wiki_sections

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

区块的 key 应保持稳定，例如：

```
description
mechanics
strategy
history
```

第一版不需要开放普通用户创建、删除或修改区块定义的权限。

### 5.4 wiki_revisions

字段：

- id。
- section_id。
- revision_no。
- parent_revision_id。
- content。
- summary。
- editor_id。
- created_at。

约束：

- 同一个区块内 revision_no 唯一。
- 只保存正式发布的内容。
- 已有 Revision 不得直接覆盖。
- parent_revision_id 表示发布时基于的上一正式版本。

正式 Revision 使用完整内容快照，不要第一版就设计复杂的增量存储。

### 5.5 wiki_edit_proposals

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

### 5.6 comments

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

### 5.7 wiki_audit_logs

字段：

- id。
- actor_id。
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

### 5.8 索引

根据查询场景建立索引：

- wiki_sections(page_id, sort_order)。
- wiki_revisions(section_id, revision_no)。
- wiki_edit_proposals(status, created_at)。
- comments(page_id, created_at)。
- comments(section_id, created_at)。
- comments(parent_id, created_at)。
- wiki_audit_logs(target_type, target_id, created_at)。

需要检查外键、唯一约束和索引在 SQLite / D1 中的实际兼容性。

## 6. 编辑与审核业务逻辑

统一采用 Section Editing。

用户点击某个区块的编辑按钮，只进入当前区块的编辑模式，不影响其他区块。

### 6.1 普通用户 member

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

### 6.2 可信贡献者 trusted

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

### 6.3 moderator

具有：

- 查看待审核修改。
- 比较修改差异。
- 审核通过。
- 审核拒绝。
- 添加审核意见。
- 查看相关版本历史。

mod­erator 可以直接发布修改，但不能随意修改管理员权限或执行管理员专属操作。

### 6.4 admin

具有完整管理权限：

- 用户角色管理。
- 用户封禁及解封。
- 审核。
- 内容管理。
- 版本恢复。
- 评论管理。
- Wiki 区块管理。

普通用户不得自行修改自己的 role。

所有权限必须在服务端执行，不能仅依赖前端隐藏按钮。

### 6.5 审核冲突

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

## 7. Revision 版本管理

实现以下功能：

### 历史记录

- 查看某个区块的所有正式版本。
- 显示版本号、修改者、修改时间和修改摘要。
- 按时间倒序展示。
- 支持分页。

### 版本差异

支持选择两个正式版本进行比较。

显示：

- 新增内容。
- 删除内容。
- 修改内容。

Markdown 内容优先使用合适的文本 diff 实现，不需要第一版就实现复杂的可视化编辑器。

### 版本恢复

恢复旧版本时：

1. 读取目标历史 Revision。
2. 将目标 Revision 的内容复制为新 Revision。
3. parent_revision_id 指向当前正式版本。
4. summary 记录恢复来源。
5. 更新当前区块版本。
6. 记录 Audit Log。

禁止直接修改历史记录或将旧 Revision 重新设置为当前版本而不生成新 Revision。

## 8. 评论系统

实现：

- 页面评论。
- 评论作者信息。
- 评论时间。

评论与 Wiki 编辑历史完全独立。

任何用户都能发表评论。

不需要实现实时聊天、WebSocket、点赞或复杂通知系统。

## 9. API 设计

使用 SvelteKit Server Routes。

建议接口：

| API                           | Method | 说明          |
| ----------------------------- | ------ | ------------- |
| /api/wiki/sections//edits     | POST   | 提交区块编辑  |
| /api/wiki/sections//revisions | GET    | 获取版本历史  |
| /api/wiki/sections//revert    | POST   | 恢复历史版本  |
| /api/wiki/proposals           | GET    | 获取审核队列  |
| /api/wiki/proposals//review   | POST   | 审核 Proposal |
| /api/wiki/pages//comments     | GET    | 获取页面评论  |
| /api/wiki/pages//comments     | POST   | 发表评论      |
| /api/comments/                | PATCH  | 修改评论      |
| /api/comments/                | DELETE | 删除评论      |

根据实际业务需要调整路由，但不要将所有业务逻辑直接写进 +server.ts。

API 层只负责：

- 请求解析。
- 参数校验。
- 身份验证。
- 权限检查。
- 调用 Service。
- 返回统一响应。

## 10. 服务端模块划分

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
- comment-service：评论及回复。
- audit-service：操作审计。
- permissions：统一角色与权限判定。
- validation：内容结构及请求校验。

不要让 Repository 承担业务规则，也不要在前端直接操作 D1。

## 11. 前端组件设计

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
└── moderation/
    ├── ProposalList.svelte
    └── ProposalReview.svelte
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

## 12. 缓存策略

第一版采用保守的缓存策略。

- SSG 索引页面：使用 Cloudflare CDN。
- 动态详情页面：SSR，读取最新正式 Wiki 内容。
- 编辑历史：服务端查询，可按需要短时间缓存。
- 评论：API 分页加载。
- 用户个人资料：避免公共缓存。
- 静态图片和资源：使用 Cloudflare CDN。

第一版不要引入复杂的缓存失效系统。

尤其不要让用户修改正式内容后还必须触发 GitHub Actions 重新构建才能看到最新内容。

## 13. 安全要求

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

不要将用户提交的任意 HTML、Svelte 组件或脚本作为 Wiki 内容直接执行。

结构化内容必须进行服务端 Schema 校验。

### 并发与事务

Revision 创建、Section 当前版本更新、Proposal 状态更新必须保证一致性。

使用 D1 支持的事务或 batch 机制。

注意：条件 UPDATE 影响 0 行不一定自动回滚整个事务，因此不能仅凭 D1 batch 没有抛出异常就认为版本更新成功。

必须检查影响行数，并保证：

- 版本检查失败时，不产生正式 Revision。
- Revision 创建失败时，不更新当前区块版本。
- Proposal 审核失败时，不错误地标记为已通过。
- 并发修改不会覆盖其他用户的正式内容。

## 14. 测试要求

沿用现有 Vitest / Playwright 配置，不要重复安装测试框架。

至少覆盖以下场景。

### 数据层

- 创建 Wiki Page。
- 创建 Wiki Section。
- 创建正式 Revision。
- 查询当前 Revision。
- 查询历史版本。
- 创建 Proposal。
- 查询待审核 Proposal。
- 评论和回复关联正确。

### 权限

- 未登录用户不能编辑。
- member 只能提交 Proposal。
- member 不能直接发布。
- trusted 可以直接发布。
- moderator 可以审核。
- admin 可以管理角色。
- suspended 用户不能进行写操作。
- 普通用户不能修改自己的角色。

### 审核

- 审核通过后创建正式 Revision。
- 审核拒绝后正式内容不变。
- 审核完成后 Proposal 状态正确。
- 重复审核不能产生重复 Revision。
- 基础版本过期时进入 conflict。
- 冲突处理不能覆盖更新后的正式版本。

### Revision

- 每次正式发布都创建新 Revision。
- 历史 Revision 不被覆盖。
- 恢复旧版本时创建新 Revision。
- Revision 父子关系正确。
- 并发更新时只有一个提交成功。

### 评论

- 页面评论正常。
- 用户不能随意修改其他人的评论。

### 前端

- 区块独立进入编辑模式。
- 取消编辑能够恢复原内容。
- 保存期间防止重复提交。
- 普通用户看到待审核状态。
- 可信贡献者看到正式发布结果。
- 版本历史和差异对比正常。
- 现有 Wiki Token 和 Entity 渲染不受影响。

### 构建

- SvelteKit build 成功。
- Prerender 路由正常生成。
- SSR 动态路由正常。
- Cloudflare Worker 本地预览正常。
- D1 Migration 可以正常执行。

## 15. 实施阶段

按照以下顺序实施。

### Phase 1：架构和数据库基础

- 检查当前项目。
- 确定 Cloudflare Workers 部署方案。
- 调整 SvelteKit adapter。
- 配置 Wrangler 和 D1。
- 建立 SQL Migration。
- 实现用户、Wiki Page、Section、Revision 数据层。
- 实现服务端身份与权限抽象。

### Phase 2：Wiki 编辑与审核

- 实现 WikiSection 通用容器。
- 实现 Markdown 编辑器。
- 实现 member Proposal 提交。
- 实现 trusted 直接发布。
- 实现 moderator 审核。
- 实现乐观锁和冲突检测。
- 实现审计记录。

### Phase 3：版本管理

- 实现历史版本列表。
- 实现版本差异比较。
- 实现历史版本恢复。
- 完善冲突处理。
- 完善并发测试。

### Phase 4：评论系统

- 页面评论。
- 区块评论。
- 评论回复。
- 编辑和删除。
- 管理员隐藏。
- 分页和限制策略。

### Phase 5：页面整合和部署

- 将 Wiki Section 接入现有卡牌、遗物、角色详情页。
- 确保游戏原始数据和 Wiki 内容正确组合。
- 实现 SSR 动态详情页面。
- 保留 SSG 索引页面。
- 完成 Cloudflare Worker 部署配置。
- 完成全部测试。

## 16. 最终验收标准

完成后，必须满足以下要求：

- 现有游戏资料功能正常。
- 现有 Wiki 特殊文本和 Entity 渲染正常。
- 卡牌、遗物等原始游戏数据没有被迁移或破坏。
- 页面支持独立区块编辑。
- 普通用户提交后必须等待审核。
- 可信贡献者可以直接发布。
- 审核通过后正式内容立即更新。
- 每次正式发布生成不可覆盖的 Revision。
- 支持历史查看、Diff 和恢复。
- 支持页面评论和区块评论。
- 所有写操作经过服务端权限检查。
- 并发修改不会静默覆盖。
- SSG 和 SSR 路由按职责正常工作。
- 可以在 Cloudflare Workers 环境运行。
- 所有数据库变更有 Migration。
- 核心业务逻辑有自动化测试。
- 不存在硬编码模拟用户或绕过权限的测试实现进入生产环境。

## 17. 最终交付

完成代码后输出：

1. 原项目架构与目标架构的差异。
2. 新增和修改的文件清单。
3. 数据库 Schema 和 Migration 说明。
4. 用户权限与审核流程说明。
5. API 接口清单。
6. SSG / SSR 路由配置说明。
7. Cloudflare 部署及环境变量配置说明。
8. 测试执行结果。
9. 尚未实现的功能和已知问题。

不要仅输出伪代码或设计建议。需要实际修改代码、执行 Migration 检查、运行测试和构建。

遇到无法完成的外部认证配置或 Cloudflare 账号操作时，明确指出需要人工提供的配置，不得伪造成功结果。