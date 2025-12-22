import { Plugin, Notice, TFile } from "obsidian";
import TabTracker from "./tabTracker";
import CanvasManager from "./canvasManager";
import { OpenTabsCanvasSettingTab, OpenTabsCanvasSettings, DEFAULT_SETTINGS } from './settings';
import { DragDropHandler } from './dragDropHandler';
import { CanvasContextMenuHandler } from './canvasContextMenu';


export default class OpenTabsCanvasPlugin extends Plugin {
	settings: OpenTabsCanvasSettings;
	private tabTracker!: TabTracker;
	private canvasManager!: CanvasManager;

	async onload() {
		await this.loadSettings();

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

		console.log("[Open Tabs Canvas] Plugin loaded with universal canvas support");
	}

	onunload() {
		// Cleanup interactive handlers
		(this.canvasManager as any).cardInteractionHandler?.cleanup();
		(this.canvasManager as any).tabSyncHandler?.cleanup();

		console.log("[Open Tabs Canvas] Plugin unloaded");
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

			// NEW: Drag-drop setup
			const dragDropHandler = new DragDropHandler(this.app, this);
			dragDropHandler.setupTabDragDropListener(canvasFile, targetLeaf);

			// NEW: Context menu
			const contextMenuHandler = new CanvasContextMenuHandler(this.app);
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
