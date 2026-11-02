import { App, TFile, WorkspaceLeaf } from "obsidian";

export type SelectionFailureReason =
	| "not-canvas"
	| "canvas-unavailable"
	| "selection-unavailable"
	| "unsupported-selection"
	| "no-selection"
	| "multiple-selection"
	| "not-file-node"
	| "missing-file";

export interface CanvasFileTarget {
	sourceLeaf: WorkspaceLeaf;
	nodeEl: HTMLElement | null;
	file: TFile;
	subpath?: string;
	nodeId?: string;
	canvasPath?: string;
}

export interface SelectionDiagnostics {
	selectionSource: "canvas.selection" | "dom-fallback" | "none";
	selectionShape?: "set-like" | "array-like" | "unknown";
	modelSelectionCount: number;
	canvasNodeCount: number;
	selectedNodeIds: string[];
	domSelectedNodeCount: number;
}

export type CanvasTargetResult =
	| {
			success: true;
			target: CanvasFileTarget;
			diagnostics: SelectionDiagnostics;
	  }
	| {
			success: false;
			reason: SelectionFailureReason;
			diagnostics: SelectionDiagnostics;
	  };

interface SelectionCollection {
	size: number;
	values(): IterableIterator<unknown>;
}

export function getSelectedCanvasFileTarget(app: App): CanvasTargetResult {
	const activeLeaf = app.workspace.activeLeaf;

	const diag: SelectionDiagnostics = {
		selectionSource: "none",
		modelSelectionCount: 0,
		canvasNodeCount: 0,
		selectedNodeIds: [],
		domSelectedNodeCount: 0,
	};

	if (!activeLeaf?.view || activeLeaf.view.getViewType() !== 'canvas') {
		return { success: false, reason: "not-canvas", diagnostics: diag };
	}

	const canvasView = activeLeaf.view as any;
	const canvas = canvasView.canvas;
	if (!canvas) {
		return { success: false, reason: "canvas-unavailable", diagnostics: diag };
	}

	const canvasPath = canvasView.file?.path;
	diag.canvasNodeCount = canvas.nodes?.size || 0;

	// Helper to count DOM selections for diagnostics
	if (canvas.nodes && canvas.nodes.size > 0) {
		canvas.nodes.forEach((nodeView: any) => {
			if (nodeView.nodeEl?.classList?.contains('is-selected')) {
				diag.domSelectedNodeCount++;
			}
		});
	}

	let selectedItems: unknown[] = [];

	// Read runtime selection model
	if (canvas.selection) {
		diag.selectionSource = "canvas.selection";

		// Check if Set-like
		if (typeof canvas.selection.size === "number" && typeof canvas.selection.values === "function") {
			diag.selectionShape = "set-like";
			selectedItems = Array.from((canvas.selection as SelectionCollection).values());
		} else if (Array.isArray(canvas.selection)) {
			diag.selectionShape = "array-like";
			selectedItems = canvas.selection;
		} else {
			diag.selectionShape = "unknown";

			return { success: false, reason: "unsupported-selection", diagnostics: diag };
		}
	} else {
		// DOM fallback
		diag.selectionSource = "dom-fallback";
		diag.selectionShape = "unknown";

		if (canvas.nodes && canvas.nodes.size > 0) {
			canvas.nodes.forEach((nodeView: any) => {
				if (nodeView.nodeEl?.classList?.contains('is-selected')) {
					selectedItems.push(nodeView);
				}
			});
		} else {
			return { success: false, reason: "selection-unavailable", diagnostics: diag };
		}
	}

	diag.modelSelectionCount = selectedItems.length;

	if (selectedItems.length === 0) {
		return { success: false, reason: "no-selection", diagnostics: diag };
	}

	if (selectedItems.length > 1) {
		return { success: false, reason: "multiple-selection", diagnostics: diag };
	}

	let selectedItem = selectedItems[0];

	// Normalize selected item (could be node ID)
	if (typeof selectedItem === "string") {
		selectedItem = canvas.nodes?.get(selectedItem);
	}

	if (!selectedItem) {
		return { success: false, reason: "not-file-node", diagnostics: diag };
	}

	const node = selectedItem as any;
	diag.selectedNodeIds = [node.id];

	const data = typeof node.getData === "function" ? node.getData() : node.data;

	if (!data || data.type !== "file") {
		return { success: false, reason: "not-file-node", diagnostics: diag };
	}

	const filePath = data.file;
	if (!filePath || typeof filePath !== "string") {
		return { success: false, reason: "not-file-node", diagnostics: diag };
	}

	const file = app.vault.getAbstractFileByPath(filePath);
	if (!file || !(file instanceof TFile)) {
		return { success: false, reason: "missing-file", diagnostics: diag };
	}

	return {
		success: true,
		diagnostics: diag,
		target: {
			sourceLeaf: activeLeaf,
			nodeEl: node.nodeEl || null,
			file,
			subpath: data.subpath,
			nodeId: node.id,
			canvasPath
		}
	};
}
