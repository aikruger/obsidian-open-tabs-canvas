import { Plugin, Notice, TFile, CanvasView } from "obsidian";

import TabTracker from "./tabTracker";
import CanvasManager from "./canvasManager";
import { OpenTabsCanvasSettingTab, OpenTabsCanvasSettings, DEFAULT_SETTINGS } from './settings';
import { CanvasContextMenuHandler } from './canvasContextMenu';
import { CanvasSelectorModal } from './canvasSelector';
import { CanvasInfoTracker } from './canvasInfo';



export interface NodeTargetResult {
	success: boolean;
	file?: TFile;
	subpath?: string;
	nodeId?: string;
	canvasPath?: string;
	reason?: string;
	selectedItemCount?: number;
}
export default class OpenTabsCanvasPlugin extends Plugin {
	/**
	 * Helper to get exactly one selected file node from the active canvas
	 */
	private getSelectedCanvasFileTarget(): NodeTargetResult {
		const activeLeaf = this.app.workspace.activeLeaf;
		if (!activeLeaf?.view || activeLeaf.view.getViewType() !== 'canvas') {
			return { success: false, reason: 'No canvas active' };
		}

		const canvasView = activeLeaf.view as CanvasView;
		const canvas = canvasView.canvas;
		if (!canvas) {
			return { success: false, reason: 'Canvas not initialized' };
		}

		const canvasPath = (canvasView as any).file?.path;

		// Extract selected nodes
		const selectedNodes: any[] = [];
		if (canvas.nodes && canvas.nodes.size > 0) {
			canvas.nodes.forEach((nodeView: any) => {
				const nodeElement = nodeView.nodeEl;
				if (nodeElement?.classList?.contains('is-selected')) {
					selectedNodes.push(nodeView);
				}
			});
		}

		if (selectedNodes.length !== 1) {
			return { success: false, reason: 'Selection is not exactly one item', selectedItemCount: selectedNodes.length };
		}

		const nodeView = selectedNodes[0];

		// Try to extract file path
		const raw = nodeView.file || nodeView.data?.file || nodeView.getData?.().file;
		let filePath = null;
		if (typeof raw === 'string') {
			filePath = raw;
		} else if (raw && typeof raw === 'object' && typeof raw.path === 'string') {
			filePath = raw.path;
		}

		if (!filePath) {
			return { success: false, reason: 'Selected item is not a file node' };
		}

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!file || !(file instanceof TFile)) {
			return { success: false, reason: 'File not found in vault' };
		}

		const subpath = nodeView.subpath || nodeView.data?.subpath || nodeView.getData?.().subpath || undefined;

		return {
			success: true,
			file,
			subpath,
			nodeId: nodeView.id || nodeView.data?.id,
			canvasPath
		};
	}

	settings: OpenTabsCanvasSettings;
	private tabTracker!: TabTracker;
	private canvasManager!: CanvasManager;
	private canvasInfoTracker!: CanvasInfoTracker;

	async onload() {
		await this.loadSettings();

		// NEW: Initialize canvas info tracker
		this.canvasInfoTracker = new CanvasInfoTracker(this.app);

		this.tabTracker = new TabTracker(this.app);
		this.canvasManager = new CanvasManager(this.app, this);

		this.addCommand({
			id: "open-tabs-to-canvas",
			name: "Open Tabs to Canvas",
			callback: async () => {
				const tabs = this.tabTracker.getAllOpenTabs();
				if (tabs.length > 0) {
					const loadingNotice = new Notice("Creating canvas...", 0);
					try {
						await this.canvasManager.createCanvasFromOpenTabs(tabs);
						loadingNotice.hide();
						new Notice(`Canvas created with ${tabs.length} tabs!`);
					} catch (error) {
						loadingNotice.hide();
						new Notice("Failed to create canvas. Check console for details.");
						console.error("[Open Tabs Canvas] Error:", error);
					}
				} else {
					new Notice("No open tabs to create a canvas from.");
				}
			},
		});

		// Register settings tab (shows up in Obsidian settings)
		this.addSettingTab(new OpenTabsCanvasSettingTab(this.app, this));

		// Add command to send open tab to canvas
		this.addCommand({
			id: 'send-tab-to-canvas',
			name: 'Add current file to canvas...',
			callback: async () => {
				const activeLeaf = this.app.workspace.activeLeaf;

				if (!activeLeaf || !activeLeaf.view || !(activeLeaf.view as any).file) {
					new Notice('No file currently open');
					return;
				}

				const currentFile = (activeLeaf.view as any).file;

				// Skip if trying to add canvas to canvas
				if (currentFile.extension === 'canvas') {
					new Notice('Cannot add canvas files to canvas');
					return;
				}

				// Get all canvases
				const canvases = this.canvasInfoTracker.getAllCanvases();

				if (canvases.length === 0) {
					new Notice('No canvases found. Create one first.');
					return;
				}

				// Show modal to select canvas
				const modal = new CanvasSelectorModal(
					this.app,
					currentFile,
					canvases.map(c => ({
						file: c.file,
						name: c.file.basename,
						lastModified: c.lastModified,
						lastFocusPoint: c.lastFocusPoint,
					})),
					async (selectedCanvas) => {
						await this.addFileToCanvas(currentFile, selectedCanvas.file, selectedCanvas.lastFocusPoint);
					}
				);

				modal.open();
			}
		});

		this.addCommand({
			id: 'canvas-scan-open-tabs',
			name: 'Canvas: Scan and highlight all open tabs',
			callback: async () => {
				const activeLeaf = this.app.workspace.activeLeaf;
				if (!activeLeaf?.view || activeLeaf.view.getViewType() !== 'canvas') {
					new Notice('No canvas currently open');
					return;
				}

				// Trigger scan
				this.canvasManager.tabScanHandler?.scanOpenTabs();
				new Notice('Canvas scanned - background tabs highlighted');
			}
		});

		// NEW: Listen for any canvas file being opened
		// This enables interactive features on ALL canvases, not just ones created by the plugin
		this.registerEvent(
			this.app.workspace.on('file-open', (file) => {
				// Check if the opened file is a canvas
				if (file && file.extension === 'canvas' && this.settings.autoActivateOnAllCanvases) {
					// Run the auto-activation check
					this.reactivateCanvasIfNeeded(file);
				}
			})
		);

		// ============================================================
		// CANVAS BATCH OPERATIONS COMMANDS
		// ============================================================

		this.addCommand({
			id: "canvas-open-all-files",
			name: "Canvas: Open all files in background",
			callback: async () => {
				const activeLeaf = this.app.workspace.activeLeaf;
				
				// Check if canvas is open
				if (!activeLeaf?.view || activeLeaf.view.getViewType() !== "canvas") {
					new Notice("No canvas currently open. Open a canvas first.");
					return;
				}
				
				const canvas = (activeLeaf.view as CanvasView).canvas;
				if (!canvas) {
					new Notice("Canvas not initialized");
					return;
				}
				
				const handler = new CanvasContextMenuHandler(this.app, this);
				const allFiles = handler.getAllFileNodes(canvas);
				
				if (allFiles.length === 0) {
					new Notice("No file cards found in this canvas");
					return;
				}
				
				try {
					await handler.openFilesInBackground(allFiles);
					new Notice(`✓ Opened ${allFiles.length} files in background`);
					console.log(`[Open Tabs Canvas] Opened ${allFiles.length} files`);
				} catch (error) {
					console.error("[Open Tabs Canvas] Error opening files:", error);
					new Notice("Error opening files. Check console for details.");
				}
			}
		});

		this.addCommand({
			id: "canvas-open-selected-files",
			name: "Canvas: Open selected files in background",
			callback: async () => {
				const activeLeaf = this.app.workspace.activeLeaf;
				
				// Check if canvas is open
				if (!activeLeaf?.view || activeLeaf.view.getViewType() !== "canvas") {
					new Notice("No canvas currently open. Open a canvas first.");
					return;
				}
				
				const canvas = (activeLeaf.view as CanvasView).canvas;
				if (!canvas) {
					new Notice("Canvas not initialized");
					return;
				}
				
				const handler = new CanvasContextMenuHandler(this.app, this);
				const selectedFiles = handler.getSelectedFileNodes(canvas);
				
				if (selectedFiles.length === 0) {
					new Notice("No files selected. Select cards first by clicking them.");
					return;
				}
				
				try {
					await handler.openFilesInBackground(selectedFiles);
					new Notice(`✓ Opened ${selectedFiles.length} selected files in background`);
					console.log(`[Open Tabs Canvas] Opened ${selectedFiles.length} selected files`);
				} catch (error) {
					console.error("[Open Tabs Canvas] Error opening files:", error);
					new Notice("Error opening files. Check console for details.");
				}
			}
		});

		this.addCommand({
			id: "canvas-show-info",
			name: "Canvas: Show canvas info",
			callback: () => {
				const activeLeaf = this.app.workspace.activeLeaf;
				
				if (!activeLeaf?.view || activeLeaf.view.getViewType() !== "canvas") {
					new Notice("No canvas currently open");
					return;
				}
				
				const canvas = (activeLeaf.view as CanvasView).canvas;
				const handler = new CanvasContextMenuHandler(this.app, this);
				const allFiles = handler.getAllFileNodes(canvas);
				const selectedFiles = handler.getSelectedFileNodes(canvas);
				
				const info = `
Canvas: ${(activeLeaf.view as any).file?.basename || "Unknown"}
Total file cards: ${allFiles.length}
Selected cards: ${selectedFiles.length}
				`.trim();
				
				new Notice(info);
				console.log(`[Open Tabs Canvas] Canvas Info: ${info}`);
			}
		});

		// NEW COMMAND: Copy all cards as wikilinks
		this.addCommand({
			id: "canvas-copy-all-wikilinks",
			name: "Canvas: Copy all file cards as wikilinks",
			callback: async () => {
				const activeLeaf = this.app.workspace.activeLeaf;
				if (!activeLeaf?.view || activeLeaf.view.getViewType() !== "canvas") {
					new Notice("No canvas currently open. Open a canvas first.");
					return;
				}

				try {
					const handler = new CanvasContextMenuHandler(this.app, this);
					const canvas = (activeLeaf.view as CanvasView).canvas;
					
					if (!canvas) {
						new Notice("Canvas not initialized");
						return;
					}

					const allFiles = handler.getAllFileNodes(canvas);
					
					if (allFiles.length === 0) {
						new Notice("No file cards found in this canvas");
						return;
					}

					await handler.copyCardsAsWikilinks(allFiles, false);
					console.log(
						`[Open Tabs Canvas] Copied ${allFiles.length} wikilinks via command`
					);
				} catch (error) {
					console.error("[Open Tabs Canvas] Error copying wikilinks:", error);
					new Notice("Error copying wikilinks. Check console for details.");
				}
			},
		});

		// NEW COMMAND: Copy selected cards as wikilinks
		this.addCommand({
			id: "canvas-copy-selected-wikilinks",
			name: "Canvas: Copy selected file cards as wikilinks",
			callback: async () => {
				const activeLeaf = this.app.workspace.activeLeaf;
				if (!activeLeaf?.view || activeLeaf.view.getViewType() !== "canvas") {
					new Notice("No canvas currently open. Open a canvas first.");
					return;
				}

				try {
					const handler = new CanvasContextMenuHandler(this.app, this);
					const canvas = (activeLeaf.view as CanvasView).canvas;
					
					if (!canvas) {
						new Notice("Canvas not initialized");
						return;
					}

					const selectedFiles = handler.getSelectedFileNodes(canvas);
					
					if (selectedFiles.length === 0) {
						new Notice(
							"No files selected. Click cards to select them (Ctrl/Cmd+Click for multiple)"
						);
						return;
					}

					await handler.copyCardsAsWikilinks(selectedFiles, false);
					console.log(
						`[Open Tabs Canvas] Copied ${selectedFiles.length} selected wikilinks via command`
					);
				} catch (error) {
					console.error("[Open Tabs Canvas] Error copying wikilinks:", error);
					new Notice("Error copying wikilinks. Check console for details.");
				}
			},
		});

		// NEW COMMAND: Copy all cards as vault links
		this.addCommand({
			id: "canvas-copy-all-vault-links",
			name: "Canvas: Copy all file cards as vault links (with paths)",
			callback: async () => {
				const activeLeaf = this.app.workspace.activeLeaf;
				if (!activeLeaf?.view || activeLeaf.view.getViewType() !== "canvas") {
					new Notice("No canvas currently open. Open a canvas first.");
					return;
				}

				try {
					const handler = new CanvasContextMenuHandler(this.app, this);
					const canvas = (activeLeaf.view as CanvasView).canvas;
					
					if (!canvas) {
						new Notice("Canvas not initialized");
						return;
					}

					const allFiles = handler.getAllFileNodes(canvas);
					
					if (allFiles.length === 0) {
						new Notice("No file cards found in this canvas");
						return;
					}

					await handler.copyCardsAsVaultLinks(allFiles);
					console.log(
						`[Open Tabs Canvas] Copied ${allFiles.length} vault links via command`
					);
				} catch (error) {
					console.error("[Open Tabs Canvas] Error copying vault links:", error);
					new Notice("Error copying vault links. Check console for details.");
				}
			},
		});


		// NEW COMMAND: Canvas: Open selected file node in Hover Editor
		this.addCommand({
			id: "canvas-open-selected-file-in-hover-editor",
			name: "Canvas: Open selected file node in Hover Editor",
			checkCallback: (checking: boolean) => {
				const target = this.getSelectedCanvasFileTarget();

				if (checking) {
					return target.success;
				}

				if (!target.success) {
					// We only get here if they somehow triggered it via palette when it should be disabled,
					// or hotkey racing condition.
					const LOG_PREFIX = "[Open Tabs Canvas][Hover Editor]";
					console.warn(`${LOG_PREFIX} Selection rejected`, {
						reason: target.reason,
						selectedItemCount: target.selectedItemCount,
					});
					return false;
				}

				// Execute
				this.openInHoverEditor(target);
				return true;
			}
		});
		console.log("[Open Tabs Canvas] Plugin loaded with universal canvas support");
	}

	onunload() {
		// Cleanup interactive handlers
		(this.canvasManager as any).cardInteractionHandler?.cleanup();
		(this.canvasManager as any).tabSyncHandler?.cleanup();

		console.log("[Open Tabs Canvas] Plugin unloaded");
	}

	/**
	 * Add a file to a canvas at a specific position
	 */
	private async addFileToCanvas(
		file: TFile,
		canvasFile: TFile,
		focusPoint: { x: number; y: number } | null
	): Promise<void> {
		try {
			// Get last focus point or use default
			const position = focusPoint || this.canvasInfoTracker.getLastFocusPoint(canvasFile.path);

			// Read existing canvas
			const content = await this.app.vault.read(canvasFile);
			const canvasData = JSON.parse(content);

			if (!canvasData.nodes) {
				canvasData.nodes = [];
			}

			// Create new node
			const newNode = {
				id: this.generateUUID(),
				type: 'file',
				file: file.path,
				x: position.x,
				y: position.y,
				width: this.settings.cardSize,
				height: this.settings.cardSize,
			};

			canvasData.nodes.push(newNode);

			// Ensure metadata exists
			if (!canvasData.metadata) {
				canvasData.metadata = { version: '1.0', frontmatter: {} };
			}

			// Write updated canvas
			const updatedContent = JSON.stringify(canvasData, null, 2);
			await this.app.vault.modify(canvasFile, updatedContent);

			new Notice(`Added "${file.basename}" to canvas`);
			console.log(`[Tabs to Canvas] Added file to canvas:`, file.path);

			// Optionally bring canvas to focus
			const leaves = this.app.workspace.getLeavesOfType('canvas');
			const canvasLeaf = leaves.find(l => (l.view as any)?.file?.path === canvasFile.path);
			if (canvasLeaf) {
				this.app.workspace.setActiveLeaf(canvasLeaf, { focus: true });
			}

		} catch (error) {
			console.error('[Tabs to Canvas] Error adding file to canvas:', error);
			new Notice('Failed to add file to canvas. Check console for details.');
		}
	}


	/**
	 * Opens the selected file node in a Hover Editor
	 */
	private async openInHoverEditor(target: NodeTargetResult): Promise<void> {
		const LOG_PREFIX = "[Open Tabs Canvas][Hover Editor]";

		console.log(`${LOG_PREFIX} Command invoked`);

		// Get hover editor plugin
		const hoverPlugin = (this.app as any).plugins?.plugins?.['obsidian-hover-editor'];

		if (!hoverPlugin || typeof hoverPlugin.spawnPopover !== 'function') {
			console.warn(`${LOG_PREFIX} Hover Editor unavailable`);
			new Notice("Install and enable Hover Editor to use this command.");
			return;
		}

		console.log(`${LOG_PREFIX} Selected target resolved`, {
			canvasPath: target.canvasPath,
			nodeId: target.nodeId,
			filePath: target.file?.path,
			subpath: target.subpath,
		});

		let hoverLeaf: any = null;
		let popoverShown = false;

		try {
			// Find initiating element, which is the active leaf container or document.body
			const activeLeaf = this.app.workspace.activeLeaf;
			const initiatingElement = activeLeaf ? activeLeaf.view.containerEl : document.body;

			// Call spawnPopover
			hoverLeaf = hoverPlugin.spawnPopover(initiatingElement, () => {
				popoverShown = true;
				// In case openFile finishes before this callback (rare, but possible)
				// we don't strictly need to do focus here if we handle it below, but keeping callback safe.
			});

			// Setup state
			const eState = target.subpath ? { subpath: target.subpath } : undefined;

			// Wait for openFile to complete
			if (target.file) {
				await hoverLeaf.openFile(target.file, { eState, active: true });
			}

			console.log(`${LOG_PREFIX} File opened`, {
				filePath: target.file?.path,
			});

			// Optional: ensure focus after it has been shown
			if (popoverShown && hoverLeaf.view) {
				this.app.workspace.setActiveLeaf(hoverLeaf, { focus: true });
			}

		} catch (error) {
			console.error(`${LOG_PREFIX} Opening failed`, {
				phase: hoverLeaf ? 'openFile' : 'spawnPopover',
				filePath: target.file?.path,
				error,
			});

			if (hoverLeaf) {
				// Clean up newly created leaf if opening failed
				hoverLeaf.detach();
			}
		}
	}
	private generateUUID(): string {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			const r = Math.random() * 16 | 0;
			const v = c === 'x' ? r : (r & 3 | 8);
			return v.toString(16);
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Automatically activate interactive features when ANY canvas file is opened
	 *
	 * LOGIC:
	 * 1. Find the workspace leaf displaying this canvas
	 * 2. Check if canvas is fully initialized with nodes
	 * 3. Validate that it contains file-type nodes (not just text/groups)
	 * 4. Activate interaction handlers with a delay for rendering
	 *
	 * WHY DELAY: Canvas needs ~800ms to fully render before we can attach listeners
	 */
	async reactivateCanvasIfNeeded(canvasFile: TFile) {
	  try {
		// Step 1: Find the leaf (workspace pane) showing this canvas
		const leaves = this.app.workspace.getLeavesOfType('canvas');
		const targetLeaf = leaves.find(leaf => {
		  // Access the canvas view's file property
		  return (leaf.view as any)?.file?.path === canvasFile.path;
		});

		if (!targetLeaf) {
		  console.warn(
			`[Open Tabs Canvas] Canvas file opened but no leaf found: ${canvasFile.path}`
		  );
		  return;
		}

		// Step 2: Get the canvas view object
		const canvasView = (targetLeaf.view as any);

		// Validate canvas is initialized
		if (!canvasView.canvas || !canvasView.canvas.nodes) {
		  console.warn(
			`[Open Tabs Canvas] Canvas not fully initialized yet: ${canvasFile.path}`
		  );
		  return;
		}

		// Step 3: Check if this canvas has any file-type nodes
		// This prevents activation on text-only or group-only canvases
		const hasFileNodes = Array.from(canvasView.canvas.nodes.values()).some(
		  (node: any) => {
			// Check both node.file and node.data.file (different canvas versions)
			return node.file || (node.data && node.data.file);
		  }
		);

		if (!hasFileNodes) {
		  console.log(
			`[Open Tabs Canvas] Canvas has no file nodes, skipping activation: ${canvasFile.path}`
		  );
		  return;
		}

		// Step 4: Wait for canvas to fully render, then activate
		setTimeout(() => {
		  try {
			// Activate card interaction (Alt+Double-click navigation)
			this.canvasManager.cardInteractionHandler.setupCardClickListeners(
			  canvasFile,
			  targetLeaf
			);

			// Activate tab sync (active file highlighting)
			this.canvasManager.tabSyncHandler.setupTabSync(targetLeaf);

			// NEW: Context menu
			const contextMenuHandler = new CanvasContextMenuHandler(this.app, this);
			contextMenuHandler.setupCanvasContextMenu(canvasFile, targetLeaf);

			console.log(
			  `[Open Tabs Canvas] ✓ All features activated on: ${canvasFile.name}`
			);

		  } catch (error) {
			console.error(
			  `[Open Tabs Canvas] Error during interaction setup:`,
			  error
			);
		  }
		}, 800); // 800ms delay allows canvas to fully render

	  } catch (error) {
		console.error(
		  `[Open Tabs Canvas] Error reactivating canvas:`,
		  error
		);
	  }
	}
}
