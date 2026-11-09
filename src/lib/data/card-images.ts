import type { Picture } from '@sveltejs/enhanced-img'

const UI_IMAGE_PATH = /card_(?:frames|banners|plaques|portrait_borders)\/[^/]+\.png$/

// /images/... 是 manifest 与组件共用的逻辑 URL；实际源文件放在 src 下供 enhancedImages 构建期处理
const modules = import.meta.glob<{ default: Picture }>(
	[
		'./card-ui/card_frames/{attack,skill,power,quest}.png',
		'./card-ui/card_banners/*.png',
		'./card-ui/card_plaques/*.png',
		'./card-ui/card_portrait_borders/*.png'
	],
	{ eager: true, query: { enhanced: true } }
)

const pictures = new Map<string, Picture>()
for (const [path, module] of Object.entries(modules)) {
	const relative = path.match(UI_IMAGE_PATH)?.[0]
	if (relative) pictures.set(`/images/${relative}`, module.default)
}

export function cardUiImage(src: string): Picture | undefined {
	return pictures.get(src)
}
