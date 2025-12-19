import { App, TFile, Notice as import_obsidian2 } from "obsidian";
import { TabInfo } from "./tabTracker";
import { CardInteractionHandler } from './cardInteraction';
import { TabSyncHandler } from './tabSync';

export default class CanvasManager {
  private cardInteractionHandler: CardInteractionHandler;
  private tabSyncHandler: TabSyncHandler;

  constructor(private app: App) {
    this.cardInteractionHandler = new CardInteractionHandler(app);
    this.tabSyncHandler = new TabSyncHandler(app);
  }

  async createCanvasFromOpenTabs(tabs: TabInfo[]): Promise<TFile | null> {
    if (tabs.length === 0) {
      return null;
    }

    console.log(`[Open Tabs Canvas] Creating canvas for ${tabs.length} tabs`);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const fileName = `Open Tabs Canvas - ${timestamp}.canvas`;

    // Step 1: Create empty canvas file
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

    // Step 2: Open canvas in new tab (background - no focus)
    let leaf: any;
    try {
      leaf = (this.app.workspace as any).getLeaf('tab');
      if (!leaf) {
        throw new Error('Could not create leaf');
      }
      await leaf.openFile(newFile, { active: false } as any);
      console.log('[Open Tabs Canvas] Canvas opened in new tab');
    } catch (e) {
      console.error('[Open Tabs Canvas] Failed to open canvas:', e);
      new import_obsidian2("Failed to create canvas.");
      throw e;
    }

    // Step 3: Wait for canvas to be ready
    await this.waitForCanvasFullyReady(leaf, 5000);

    // Step 4: Generate canvas data with all tabs as nodes
    const canvasData = this.generateCanvasJSON(tabs);
    console.log(
      "[Open Tabs Canvas] Generated canvas data with nodes:",
      canvasData.nodes.length
    );

    // Step 5: Write canvas data to file
    await new Promise((resolve) => setTimeout(resolve, 800));
    const jsonString = JSON.stringify(canvasData, null, 2);
    await this.app.vault.modify(newFile, jsonString);
    console.log("[Open Tabs Canvas] Data written to file");

    // Step 6: Wait for file to save
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Step 7: Setup interaction handlers
    this.cardInteractionHandler.setupCardClickListeners(newFile, leaf);
    this.tabSyncHandler.setupTabSync(leaf);

    console.log(`[Open Tabs Canvas] Interactive features enabled`);
    console.log(`[Open Tabs Canvas] Complete! Canvas has ${tabs.length} nodes`);

    return newFile;
  }

  private async waitForCanvasFullyReady(leaf: any, maxWait = 3000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      const view = (leaf as any).view;
      if (view && (view as any).canvas) {
        const nodes = (view as any).canvas.nodes;
        if (nodes && nodes.size > 0) {
          console.log(`[Open Tabs Canvas] Canvas ready with ${nodes.size} nodes`);
          await new Promise((resolve) => setTimeout(resolve, 500));
          return true;
        }
        // Consider canvas ready when exists even if nodes not yet populated
        console.log('[Open Tabs Canvas] Canvas view detected');
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    console.warn("[Open Tabs Canvas] Timeout waiting for Canvas initialization");
    return false;
  }

  private generateCanvasJSON(tabs: TabInfo[]) {
    const nodes: any[] = [];
    const positions = this.calculateMosaicPositions(tabs.length);

    console.log("[DEBUG] Tabs to process:", tabs.length);

    tabs.forEach((tab, index) => {
      console.log(`[DEBUG] Tab ${index}:`, {
        file: tab.file,
        path: tab.file?.path,
        displayName: tab.displayName,
      });
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
        console.log(`[DEBUG] Created node ${index}:`, node);
        nodes.push(node);
      } else {
        console.warn(`[DEBUG] Skipped tab ${index} - no file path`);
      }
    });

    console.log("[DEBUG] Total nodes created:", nodes.length);

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
