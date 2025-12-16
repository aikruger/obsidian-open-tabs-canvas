import { Plugin, Notice } from "obsidian";
import TabTracker from "./tabTracker";
import CanvasManager from "./canvasManager";

export default class OpenTabsCanvasPlugin extends Plugin {
	private tabTracker!: TabTracker;
	private canvasManager!: CanvasManager;

	async onload() {
		this.tabTracker = new TabTracker(this.app);
		this.canvasManager = new CanvasManager(this.app);

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

		console.log("[Open Tabs Canvas] Plugin loaded");
	}

	onunload() {
		console.log("[Open Tabs Canvas] Plugin unloaded");
	}
}
