/** 按顺序加载脚本，返回用于销毁页面的清理函数。 */
export function loadToolScripts(urls: string[]): () => void {
	const scripts: HTMLScriptElement[] = [];
	let disposed = false;

	void (async () => {
		for (const url of urls) {
			if (disposed) return;

			try {
				await new Promise<void>((resolve, reject) => {
					const script = document.createElement('script');
					script.src = url;
					script.async = false;
					script.onload = () => resolve();
					script.onerror = () => reject(new Error(`Failed to load ${url}`));
					document.body.appendChild(script);
					scripts.push(script);
				});
			} catch {
				return;
			}
		}
	})();

	return () => {
		disposed = true;
		for (const script of scripts) script.remove();
	};
}
