import { App, TFile, WorkspaceLeaf, EventRef, CanvasView, ItemView } from 'obsidian';

// Interface for Canvas Node View
interface NodeView {
  nodeEl: HTMLElement;
  file?: TFile | string; // Can be a TFile object or a path string
}

export class TabScanHandler {
  app: App;
  canvasView: any | null = null;
  openTabsMap: Map<string, boolean>;      // filepath -> isOpen
  eventRef: EventRef | null = null;

  constructor(app: App) {
    this.app = app;
    this.openTabsMap = new Map();
  }

  // Main scan operation
  scanOpenTabs(): void {
    if (!this.canvasView) return;

    // 1. Build map of currently open file paths
    const openTabs = this.getAllOpenMarkdownLeaves();
    const newOpenMap = new Map<string, boolean>();
    openTabs.forEach(file => {
      newOpenMap.set(file.path, true);
    });

    // 2. Get all file nodes from canvas
    const canvasNodes = this.getAllCanvasFileNodes();

    // 3. Update highlights for each node
    canvasNodes.forEach((nodeView, filePath) => {
      const isOpen = newOpenMap.has(filePath);
      this.updateNodeHighlight(nodeView, isOpen);
    });

    this.openTabsMap = newOpenMap;
    console.log(`[Open Tabs Canvas] Scanned: ${openTabs.length} tabs, marked ${openTabs.length} canvas nodes`);
  }

  // Get all markdown leaves
  private getAllOpenMarkdownLeaves(): TFile[] {
    const files: TFile[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (leaf.view && (leaf.view as any).file) {
         files.push((leaf.view as any).file);
      }
    });
    return files;
  }

  // Get all file nodes from canvas
  private getAllCanvasFileNodes(): Map<string, NodeView> {
    const fileNodes = new Map<string, NodeView>();
    if (!this.canvasView || !this.canvasView.canvas) return fileNodes;

    const nodes = this.canvasView.canvas.nodes;
    if (!nodes) return fileNodes;

    nodes.forEach((node: any) => {
        // Check if it's a file node
        let filePath = '';
        if (node.file && typeof node.file === 'string') {
            filePath = node.file;
        } else if (node.file && node.file.path) {
            filePath = node.file.path;
        } else if (node.data && node.data.file) {
            filePath = node.data.file;
        }

        if (filePath) {
            fileNodes.set(filePath, node);
        }
    });

    return fileNodes;
  }

  // Apply or remove highlight based on tab status
  private updateNodeHighlight(nodeView: NodeView, isOpen: boolean): void {
     const el = nodeView.nodeEl;
     if (!el) return;

     if (isOpen) {
         el.classList.add('is-background-tab-open');
     } else {
         el.classList.remove('is-background-tab-open');
     }
  }

  // Setup listeners for when tabs are opened/closed
  setupTabChangeListeners(canvasView: any): void {
      this.canvasView = canvasView;
      this.scanOpenTabs();

      // We hook into the same active-leaf-change or layout-change in TabSyncHandler or Main
      // But we can also add specific listeners if needed.
      // For now, scanOpenTabs is called by TabSyncHandler on events.
  }

  // Handle tab closed (metadata change)
  // private onTabClosed(): void;

  // Cleanup
  cleanup(): void {
      this.canvasView = null;
      this.openTabsMap.clear();
  }
}
