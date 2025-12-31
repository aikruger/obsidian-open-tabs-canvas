import { App, EventRef } from 'obsidian';
import { TabScanHandler } from './tabScanHandler';

export class TabSyncHandler {
  private app: App;
  private canvasView: any;
  private activeFileMap: Map<string, any> = new Map();
  private eventRef: EventRef | null = null;
  private hasRetriedBuildingMap: boolean = false; // retry guard
  private tabScanHandler: TabScanHandler;

  constructor(app: App, tabScanHandler: TabScanHandler) {
    this.app = app;
    this.tabScanHandler = tabScanHandler;
  }

  /**
   * Initialize tab sync for canvas
   */
  setupTabSync(leaf: any) {
    this.canvasView = leaf.view;
    this.hasRetriedBuildingMap = false; // reset retry for new canvas

    if (!this.canvasView || !this.canvasView.canvas) {
      console.warn('[Open Tabs Canvas] Canvas view not available for tab sync');
      return;
    }

    // Initialize scan handler
    this.tabScanHandler.setupTabChangeListeners(this.canvasView);

    // Build initial file-to-node mapping
    this.buildFileNodeMap();

    // NEW: Perform initial scan
    this.tabScanHandler.scanOpenTabs();

    // Listen for active leaf changes
    this.setupActiveLeafListener();

    console.log('[Open Tabs Canvas] Tab sync initialized');
  }

  /**
   * Build a map of file paths to node views (direct property access + single retry)
   */
  private buildFileNodeMap() {
    this.activeFileMap.clear();
    const canvas = this.canvasView.canvas;

    if (!canvas.nodes || canvas.nodes.size === 0) {
      console.warn('[Open Tabs Canvas] No nodes found when building file map');
      return;
    }

    let validNodeCount = 0;

    canvas.nodes.forEach((nodeView: any) => {
      if (!nodeView) {
        console.warn('[Open Tabs Canvas] Invalid nodeView');
        return;
      }

      const raw = nodeView.file;

      // Extract path from either string or TFile object
      const filePath =
        typeof raw === 'string'
          ? raw
          : raw && typeof raw === 'object' && typeof raw.path === 'string'
            ? raw.path
            : null;

      if (filePath) {
        this.activeFileMap.set(filePath, nodeView);
        validNodeCount++;
      } else {
        console.warn('[Open Tabs Canvas] Node file not usable:', {
          hasFile: !!raw,
          rawType: typeof raw,
        });
      }
    });

    console.log(`[Open Tabs Canvas] Built file-to-node map with ${validNodeCount}/${canvas.nodes.size} entries`);

    // Only retry once if initial attempt finds no valid nodes
    if (validNodeCount === 0 && canvas.nodes.size > 0) {
      if (!this.hasRetriedBuildingMap) {
        console.log('[Open Tabs Canvas] No valid file nodes found, retrying once in 1 second...');
        this.hasRetriedBuildingMap = true;
        setTimeout(() => {
          this.buildFileNodeMap();
        }, 1000);
      } else {
        console.error('[Open Tabs Canvas] Failed to build file node map after retry. Canvas nodes may not be fully initialized.');
      }
    }
  }

  /**
   * Listen to workspace active leaf changes
   */
  private setupActiveLeafListener() {
    // Remove previous listener if any
    if (this.eventRef) {
      this.app.workspace.offref(this.eventRef);
      this.eventRef = null;
    }

    // Setup listener using Obsidian's event system
    this.eventRef = this.app.workspace.on('active-leaf-change', () => {
      this.updateActiveHighlight();

      // NEW: Re-scan to update background tab status
      this.tabScanHandler.scanOpenTabs();
    });

    // Initial highlight
    this.updateActiveHighlight();
  }

  /**
   * Update highlighting based on currently active file
   */
  private updateActiveHighlight() {
    try {
      const activeLeaf = this.app.workspace.activeLeaf;
      
      if (!activeLeaf || !activeLeaf.view) {
        this.clearAllHighlights();
        return;
      }

      const view = activeLeaf.view as any;
      
      // Check if active view is a file view
      if (view.getViewType() === 'empty' || !view.file) {
        this.clearAllHighlights();
        return;
      }

      const activeFilePath = view.file.path;

      // Clear all existing highlights first
      this.clearAllHighlights();

      // Find and highlight the matching node
      const nodeView = this.activeFileMap.get(activeFilePath);
      
      if (nodeView) {
        this.highlightNode(nodeView);
        console.log(`[Open Tabs Canvas] Highlighted node for: ${activeFilePath}`);
      } else {
        console.log(`[Open Tabs Canvas] No canvas node found for active file: ${activeFilePath}`);
      }

    } catch (error) {
      console.error('[Open Tabs Canvas] Error updating highlight:', error);
    }
  }

  /**
   * Apply active highlight to a node
   */
  private highlightNode(nodeView: any) {
    const nodeElement = nodeView.nodeEl as HTMLElement;
    
    if (!nodeElement) {
      console.warn('[Open Tabs Canvas] Node element not found');
      return;
    }

    // Add the active class
    nodeElement.classList.add('is-active-tab');
    
    // Apply glow effect
    this.applyActiveStyling(nodeElement);

    console.log('[Open Tabs Canvas] Applied highlight to node');
  }

  /**
   * Remove all active highlights
   */
  private clearAllHighlights() {
    const canvas = this.canvasView?.canvas;
    
    if (!canvas || !canvas.nodes) {
      return;
    }

    canvas.nodes.forEach((nodeView: any) => {
      const nodeElement = nodeView.nodeEl as HTMLElement;
      
      if (nodeElement) {
        nodeElement.classList.remove('is-active-tab');
        // Clear inline styles
        nodeElement.style.boxShadow = '';
      }
    });
  }

  /**
   * Apply inline styling for active state
   */
  private applyActiveStyling(element: HTMLElement) {
    // Primary glow effect
    element.style.boxShadow = `
      0 0 12px 2px rgba(33, 128, 141, 0.5),
      inset 0 0 12px rgba(33, 128, 141, 0.1)
    `.trim();
  }

  /**
   * Cleanup when canvas closes
   */
  cleanup() {
    this.clearAllHighlights();
    
    if (this.eventRef) {
      this.app.workspace.offref(this.eventRef);
      this.eventRef = null;
    }
    
    this.activeFileMap.clear();
    this.canvasView = null;
    this.hasRetriedBuildingMap = false;
  }
}
