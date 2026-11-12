/**


 * 卡框 HSV 着色：复刻 tools/card-frame-preview 的 res://shaders/hsv.gdshader。
 * 原着色器在 YIQ 空间做 色相旋转 + 饱和度缩放 + 明度缩放，再转回 RGB。
 * 整条链路都是 3x3 线性变换的组合，因此可等价为单个 RGB 3x3 矩阵，
 * 用 SVG feColorMatrix 直接施加到卡框图片上（GPU 加速、SSR 友好）。
 */

type Mat3 = [
	number, number, number,
	number, number, number,
	number, number, number
];

function mul(a: Mat3, b: Mat3): Mat3 {
	const r: Mat3 = [0, 0, 0, 0, 0, 0, 0, 0, 0];
	for (let i = 0; i < 3; i++) {
		for (let j = 0; j < 3; j++) {
			let s = 0;
			for (let k = 0; k < 3; k++) s += a[i * 3 + k] * b[k * 3 + j];
			r[i * 3 + j] = s;
		}
	}
	return r;
}

export interface FrameShader {
	h: number;
	s: number;
	v: number;
}

// 原着色器常量（列主序 mat3 按标准数学矩阵转写）
const RGB_TO_YIQ: Mat3 = [
	0.2989, 0.587, 0.114,
	0.5959, -0.2774, -0.3216,
	0.2115, -0.5229, 0.3114
];
const YIQ_TO_RGB: Mat3 = [
	1.003061, 0.955205, 0.619283,
	0.999257, -0.271767, -0.646486,
	0.996674, -1.105116, 1.705119
];

/**
 * 由 HSV 生成 feColorMatrix 的 20 个数值（RGB 三行取自合成矩阵，alpha 恒等，无偏移）。
 * 与 card-frame-preview 中 GLSL 的运算顺序完全一致：YIQ -> 色相 -> 饱和 -> 明度 -> RGB。
 */
export function frameTintMatrix({ h, s, v }: FrameShader): number[] {
	const hue = (1 - h) * Math.PI * 2;
	const ch = Math.cos(hue);
	const sh = Math.sin(hue);
	// 原着色器是 col.rgb *= hue_shift（行向量 × 矩阵），等价于列向量左乘 hue_shift 的转置。
	// hue_shift = mat3(vec3(1,0,0), vec3(0,ch,-sh), vec3(0,sh,ch))，其转置为下面的 (I,Q) 旋转。
	const HUE: Mat3 = [1, 0, 0, 0, ch, -sh, 0, sh, ch];
	const SAT: Mat3 = [1, 0, 0, 0, s, 0, 0, 0, s];
	const VAL: Mat3 = [v, 0, 0, 0, v, 0, 0, 0, v];

	let t: Mat3 = YIQ_TO_RGB;
	t = mul(t, VAL);
	t = mul(t, SAT);
	t = mul(t, HUE);
	t = mul(t, RGB_TO_YIQ);

	return [
		t[0], t[1], t[2], 0, 0,
		t[3], t[4], t[5], 0, 0,
		t[6], t[7], t[8], 0, 0,
		0, 0, 0, 1, 0
	];
}

export function frameTintFilterId(color: string): string {
	return `frame-tint-${color}`;
}
