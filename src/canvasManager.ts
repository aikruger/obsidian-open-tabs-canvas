import { App, TFile } from 'obsidian';
import { OpenTabInfo } from './tabTracker';

// --- Interfaces for Canvas Data Structure ---

interface CanvasNode {
  id: string;
  type: 'file';
  file: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasEdge {
  id:string;
  fromNode: string;
  toNode: string;
}

interface CanvasData {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export class CanvasManager {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  async createCanvasFromOpenTabs(tabs: OpenTabInfo[]): Promise<TFile | null> {
    if (tabs.length === 0) {
      return null;
    }

    const canvasData = this.generateCanvasJSON(tabs);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `Open Tabs Canvas - ${timestamp}.canvas`;

    const newFile = await this.app.vault.create(
      fileName,
      JSON.stringify(canvasData, null, 2)
    );

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(newFile);

    return newFile;
  }

  private generateCanvasJSON(tabs: OpenTabInfo[]): CanvasData {
    const nodes: CanvasNode[] = [];
    const positions = this.calculateMosaicPositions(tabs.length);

    tabs.forEach((tab, index) => {
      if (tab.file) {
        nodes.push({
          id: this.generateUUID(),
          type: 'file',
          file: tab.file.path,
          x: positions[index].x,
          y: positions[index].y,
          width: 250,
          height: 250,
        });
      }
    });

    return { nodes, edges: [] };
  }

  private calculateMosaicPositions(
      cardCount: number,
      cardWidth: number = 250,
      cardHeight: number = 250,
      spacing: number = 50
    ): Array<{ x: number; y: number }> {
      const positions: Array<{ x: number; y: number }> = [];
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
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
