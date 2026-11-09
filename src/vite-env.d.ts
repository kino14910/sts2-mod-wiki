declare module 'virtual:mods' {
	export const manifestFiles: Record<string, unknown>;
	export const dataFiles: Record<string, unknown>;
	export const localizationFiles: Record<string, unknown>;
	export const cardImageFiles: Record<string, Record<string, string>>;
	export const cardThumbFiles: Record<string, Record<string, string>>;
}
