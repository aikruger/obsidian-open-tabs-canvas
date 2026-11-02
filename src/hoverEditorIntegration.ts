
import { App, Notice, WorkspaceLeaf } from "obsidian";
import { CanvasFileTarget, CanvasTargetResult } from "./canvasSelection";

export async function openInHoverEditor(app: App, result: CanvasTargetResult): Promise<void> {
	const LOG_PREFIX = "[Open Tabs Canvas][Hover Editor]";

	if (!result.success) {
		console.warn(`${LOG_PREFIX} Selection rejected`, {
			reason: result.reason,
			selectedItemCount: result.diagnostics.modelSelectionCount,
			selectionSource: result.diagnostics.selectionSource,
			canvasPath: 'unknown',
		});
		return;
	}

	const { target } = result;

	console.log(`${LOG_PREFIX} Command invoked`);

	const hoverPlugin = (app as any).plugins?.plugins?.['obsidian-hover-editor'];

	if (!hoverPlugin || typeof hoverPlugin.spawnPopover !== 'function') {
		console.warn(`${LOG_PREFIX} Hover Editor unavailable`);
		new Notice("Install and enable Hover Editor to use this command.");
		return;
	}

	let hoverLeaf: WorkspaceLeaf | null = null;
	let shown = false;
	let opened = false;
	let focused = false;
	let failed = false;

	const focusWhenReady = () => {
		if (failed || focused || !shown || !opened || !hoverLeaf) return;
		app.workspace.setActiveLeaf(hoverLeaf, { focus: true });
		focused = true;
	};

	try {
		const initiatingElement = target.nodeEl || target.sourceLeaf.view.containerEl;

		hoverLeaf = hoverPlugin.spawnPopover(initiatingElement, () => {
			shown = true;
			focusWhenReady();
		});

		const eState = target.subpath ? { subpath: target.subpath } : undefined;

		await (hoverLeaf as any).openFile(target.file, { eState, active: false });
		opened = true;

		console.log(`${LOG_PREFIX} File opened`, {
			filePath: target.file.path,
		});

		focusWhenReady();

	} catch (error) {
		failed = true;
		console.error(`${LOG_PREFIX} Opening failed`, {
			phase: hoverLeaf ? 'openFile' : 'spawnPopover',
			filePath: target.file.path,
			error,
		});

		new Notice("Failed to open file in Hover Editor.");

		if (hoverLeaf) {
			try {
				hoverLeaf.detach();
			} catch (detachError) {
				console.error(`${LOG_PREFIX} Cleanup failed`, detachError);
			}
		}
	}
}
