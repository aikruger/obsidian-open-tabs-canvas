import { App, TFile } from "obsidian";
import { TabInfo } from "./tabTracker";

export default class CanvasManager {
  constructor(private app: App) {}

  async createCanvasFromOpenTabs(tabs: TabInfo[]): Promise<TFile | null> {
    if (tabs.length === 0) {
      return null;
    }

    console.log(`[Open Tabs Canvas] Creating canvas for ${tabs.length} tabs`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `Open Tabs Canvas - ${timestamp}.canvas`;

    // STEP 1: Create file with COMPLETE empty structure
    const emptyStructure = JSON.stringify(
      {
        nodes: [],
        edges: [],
        metadata: { version: "1.0", frontmatter: {} },
      },
      null,
      2
    );

    const newFile = await this.app.vault.create(fileName, emptyStructure);
    console.log("[Open Tabs Canvas] Empty canvas file created");

    // STEP 2: Open canvas - DO NOT WAIT YET
    const leaf = await (this.app.workspace as any).getLeaf(false);
    await leaf.openFile(newFile);

    // STEP 3: CRITICAL - Wait for Canvas plugin to fully initialize
    await this.waitForCanvasFullyReady(leaf, 3000);

    // STEP 4: Generate canvas data
    const canvasData = this.generateCanvasJSON(tabs);
    console.log(
      "[Open Tabs Canvas] Generated canvas data with nodes:",
      canvasData.nodes.length
    );

    // STEP 5: CRITICAL - Write data while Canvas is NOT actively reading
    await new Promise((resolve) => setTimeout(resolve, 500));

    const jsonString = JSON.stringify(canvasData, null, 2);
    await this.app.vault.modify(newFile, jsonString);
    console.log("[Open Tabs Canvas] Data written to file");

    // STEP 6: Force Canvas to reload the file it just modified
    await new Promise((resolve) => setTimeout(resolve, 300));
    await this.forceCanvasReload(leaf);

    console.log(`[Open Tabs Canvas] Complete! Canvas has ${tabs.length} nodes`);
    return newFile;
  }

  // NEW: Detect when Canvas view has FULLY initialized
  private async waitForCanvasFullyReady(leaf: any, maxWait = 3000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const view = (leaf as any).view;

      // Check for Canvas view with all required properties
      if (
        view &&
        (view as any).canvas &&
        (view as any).canvas.data !== undefined &&
        (view as any).data !== undefined &&
        typeof (view as any).updateData === 'function'
      ) {
        console.log("[Open Tabs Canvas] Canvas view fully initialized");
        await new Promise((resolve) => setTimeout(resolve, 300));
        return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    console.warn("[Open Tabs Canvas] Timeout waiting for Canvas initialization");
    return false;
  }

  // NEW: Force Canvas to reread and rerender
  private async forceCanvasReload(leaf: any): Promise<void> {
    const view = (leaf as any).view;

    if (!view || !(view as any).canvas) {
      console.error("[Open Tabs Canvas] Canvas view not available for reload");
      return;
    }

    try {
      // Method 1: Call Canvas's internal load method
      if (typeof (view as any).load === 'function') {
        console.log("[Open Tabs Canvas] Triggering Canvas.load()");
        await (view as any).load();
        await new Promise((resolve) => setTimeout(resolve, 200));
        return;
      }
    } catch (e) {
      console.warn("[Open Tabs Canvas] Canvas.load() not available:", e);
    }

    try {
      // Method 2: Trigger data update
      if ((view as any).data && typeof (view as any).updateData === 'function') {
        console.log("[Open Tabs Canvas] Triggering Canvas.updateData()");
        await (view as any).updateData((view as any).data);
        await new Promise((resolve) => setTimeout(resolve, 200));
        return;
      }
    } catch (e) {
      console.warn("[Open Tabs Canvas] updateData() failed:", e);
    }

    // Method 3: Nuclear option - close and reopen
    console.log("[Open Tabs Canvas] Using nuclear reload: close and reopen");
    const file = (view as any).file;
    await leaf.detach();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const newLeaf = await (this.app.workspace as any).getLeaf(false);
    await newLeaf.openFile(file);
    await this.waitForCanvasFullyReady(newLeaf, 2000);
  }

  private generateCanvasJSON(tabs: TabInfo[]) {
    const nodes: any[] = [];
    const positions = this.calculateMosaicPositions(tabs.length);

    tabs.forEach((tab, index) => {
      if (tab.file && tab.file.path) {
        const node = {
          id: this.generateUUID(),
          type: "file",
          file: tab.file.path,
          x: positions[index].x,
          y: positions[index].y,
          width: 250,
          height: 250,
        };
        nodes.push(node);
      }
    });

    // CRITICAL: Complete Canvas metadata structure
    return {
      nodes,
      edges: [],
      metadata: {
        version: "1.0",
        frontmatter: {},
      },
    };
  }

  private calculateMosaicPositions(
    cardCount: number,
    cardWidth: number = 250,
    cardHeight: number = 250,
    spacing: number = 50
  ) {
    const positions: { x: number; y: number }[] = [];
    const columnsPerRow = Math.ceil(Math.sqrt(cardCount));

    for (let i = 0; i < cardCount; i++) {
      const row = Math.floor(i / columnsPerRow);
      const col = i % columnsPerRow;
      const x = col * (cardWidth + spacing);
      const y = row * (cardHeight + spacing);
      positions.push({ x, y });
    }

    return positions;
  }

  private generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
