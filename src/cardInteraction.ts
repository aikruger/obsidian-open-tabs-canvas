import { App, Notice } from 'obsidian';

export class CardInteractionHandler {
  private app: App;
  private canvasView: any;
  private activeCanvasFile: any;
  private eventHandlers: Map<HTMLElement, {
    mouseenterHandler: (e: MouseEvent) => void;
    dblclickHandler: (e: MouseEvent) => void;
  }>;

  private canvasClickRef: any | null;
  private allCanvases: Set<string>;
  private previousCanvasNodes: Set<string> | null;
  private canvasChangeRef: any | null; // track canvas change listener

  constructor(app: App) {
    this.app = app;
    this.eventHandlers = new Map();
    this.canvasClickRef = null;
    this.allCanvases = new Set();
    this.previousCanvasNodes = null;
    this.canvasChangeRef = null; // NEW
  }

  /**
   * Setup event listeners on canvas nodes
   * Call this after canvas is opened and ready
   */
  setupCardClickListeners(canvasFile: any, leaf: any) {
    this.activeCanvasFile = canvasFile;
    this.canvasView = leaf.view;

    if (!this.canvasView || !this.canvasView.canvas) {
      console.warn('[Open Tabs Canvas] Canvas view not available');
      return;
    }

    this.setupGlobalCanvasListener();
    this.registerCanvasInstance(canvasFile, leaf);

    const canvas = this.canvasView.canvas;
    if (canvas) {
      // this.setupCardDeleteListener(canvas);
    }
  }

  registerCanvasInstance(canvasFile: any, leaf: any) {
    const path = (canvasFile?.path || canvasFile) as string;
    if (path) {
      this.allCanvases.add(path);
      console.log(`[Open Tabs Canvas] Registered canvas: ${path}`);
    }

    const canvas = leaf?.view?.canvas;
    if (canvas) {
      setTimeout(() => {
        this.attachNodeEventListeners(canvas);
        // this.setupCardDeleteListener(canvas);
      }, 800);
    }
  }

  setupGlobalCanvasListener() {
    if (this.canvasClickRef) return;

    this.canvasClickRef = (this.app.workspace as any).on('layout-change', () => {
      try {
        const canvases = (this.app.workspace as any).getLeavesOfType('canvas') as any[];
        canvases.forEach((leaf) => {
          const canvas = leaf?.view?.canvas;
          if (canvas) {
            this.attachNodeEventListeners(canvas);
            // this.setupCardDeleteListener(canvas);
          }
        });
      } catch (e) {
        console.warn('[Open Tabs Canvas] Global canvas listener error:', e);
      }
    });

    console.log('[Open Tabs Canvas] Global canvas listener initialized');
  }

  /**
   * Attach click listeners to all rendered canvas nodes
   */
  private attachNodeEventListeners(canvas: any) {
    if (!canvas?.nodes || canvas.nodes.size === 0) {
      console.warn('[Open Tabs Canvas] No nodes found in canvas');
      return;
    }

    // Iterate through all nodes in the canvas
    canvas.nodes.forEach((nodeView: any) => {
      this.setupNodeInteraction(nodeView, canvas);
    });

    console.log(`[Open Tabs Canvas] Attached interaction listeners to ${canvas.nodes.size} nodes`);
  }

  /**
   * Setup listener for card deletion (tracking only)
   * Does NOT automatically close tabs
   */
  private setupCardDeleteListener(canvas: any) {
    if (!canvas) return;

    const buildNodeToFileMap = () => {
      const map = new Map<string, string>();
      if (canvas.nodes && typeof canvas.nodes.entries === 'function') {
        for (const [nodeId, nodeView] of canvas.nodes.entries()) {
          const raw = (nodeView as any).file;
          const filePath =
            typeof raw === 'string'
              ? raw
              : raw && typeof raw === 'object' && typeof (raw as any).path === 'string'
              ? (raw as any).path
              : null;
          if (filePath) {
            map.set(String(nodeId), filePath);
          }
        }
      }
      return map;
    };

    let nodeToFileMap = buildNodeToFileMap();

    const handleCanvasChange = () => {
      try {
        const newNodeToFileMap = buildNodeToFileMap();
        for (const [oldNodeId] of nodeToFileMap) {
          if (!newNodeToFileMap.has(oldNodeId)) {
            const filePath = nodeToFileMap.get(oldNodeId);
            console.log(`[Open Tabs Canvas] Card deleted from canvas: ${filePath}`);
          }
        }
        nodeToFileMap = newNodeToFileMap;
      } catch (e) {
        console.warn('[Open Tabs Canvas] Error tracking card deletion:', e);
      }
    };

    // Use file-open event to detect canvas changes (fires when canvas is modified)
    if (!this.canvasChangeRef) {
      this.canvasChangeRef = (this.app.workspace as any).on('file-open', (file: any) => {
        if (file && typeof file.path === 'string' && file.path.endsWith('.canvas')) {
          handleCanvasChange();
        }
      });
    }

    console.log('[Open Tabs Canvas] Card deletion tracking initialized');
  }

  /**
   * Setup interaction for individual node
   */
  private setupNodeInteraction(nodeView: any, canvas: any) {
    // Get the DOM element for this node
    const nodeElement = nodeView.nodeEl as HTMLElement;
    
    if (!nodeElement) {
      return;
    }

    // Clean up existing handlers
    if (this.eventHandlers.has(nodeElement)) {
      const old = this.eventHandlers.get(nodeElement)!;
      nodeElement.removeEventListener('mouseenter', old.mouseenterHandler);
      nodeElement.removeEventListener('dblclick', old.dblclickHandler, true);
    }

    const mouseenterHandler = () => {
      nodeElement.style.cursor = 'pointer';
      nodeElement.title = 'Alt + Double-click to open file';
    };
    nodeElement.addEventListener('mouseenter', mouseenterHandler);

    // Real dblclick navigation with Alt
    const dblclickHandler = (event: MouseEvent) => {
      if (!event.altKey) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      this.handleCardNavigation(nodeView);
    };
    nodeElement.addEventListener('dblclick', dblclickHandler, true);

    this.eventHandlers.set(nodeElement, {
      mouseenterHandler,
      dblclickHandler,
    });
  }

  /**
   * Navigate to the file represented by this card
   */
  private async handleCardNavigation(nodeView: any) {
    try {
      // Access file property directly on nodeView (not nodeView.node!)
      if (!nodeView || !nodeView.file) {
        console.warn('[Open Tabs Canvas] NodeView has no file property');
        return;
      }

      // Extract file path - nodeView.file may be a TFile object or a string
      let filePath: string;
      if (typeof nodeView.file === 'string') {
        filePath = nodeView.file as string;
      } else if (nodeView.file && (nodeView.file as any).path) {
        filePath = (nodeView.file as any).path as string;
      } else {
        console.warn('[Open Tabs Canvas] Could not extract file path from nodeView.file');
        return;
      }

      console.log(`[Open Tabs Canvas] Attempting to navigate to: ${filePath}`);

      // Get the file from vault
      const file = this.app.vault.getAbstractFileByPath(filePath);
      if (!file || (file as any).extension === undefined) {
        console.error(`[Open Tabs Canvas] Could not find file: ${filePath}`);
        new Notice(`File not found: ${filePath}`);
        return;
      }

      // First, try to find an existing leaf with this file
      let targetLeaf: any = null;
      const leaves = (this.app.workspace as any).getLeavesOfType('markdown') as any[];
      for (const leaf of leaves) {
        if (leaf.view && leaf.view.file && leaf.view.file.path === filePath) {
          targetLeaf = leaf;
          break;
        }
      }

      if (targetLeaf) {
        (this.app.workspace as any).setActiveLeaf(targetLeaf, { focus: true });
        console.log(`[Open Tabs Canvas] Switched to existing tab: ${filePath}`);
        new Notice(`Switched to: ${(file as any).basename}`);
      } else {
        const ws: any = this.app.workspace as any;
        const activeLeaf = ws.activeLeaf;
        let targetContainer = activeLeaf?.parent;
        if (!targetContainer) {
          targetContainer = ws.rootSplit;
        }
        try {
          const newLeaf = await targetContainer.insertLeaf(targetContainer.children.length, 'vertical');
          if (newLeaf) {
            await newLeaf.openFile(file as any);
            console.log(`[Open Tabs Canvas] Opened file in background: ${filePath}`);
            new Notice(`Opened in background: ${(file as any).basename}`);
          } else {
            console.error('[Open Tabs Canvas] Could not create leaf');
            new Notice('Error: Could not open file');
          }
        } catch (e) {
          const fallbackLeaf = ws.getLeaf('tab');
          if (fallbackLeaf) {
            await fallbackLeaf.openFile(file as any, { active: false } as any);
            console.log(`[Open Tabs Canvas] Opened file (fallback) in background: ${filePath}`);
            new Notice(`Opened in background: ${(file as any).basename}`);
          } else {
            console.error('[Open Tabs Canvas] No leaf available');
            new Notice('Error: Could not open file');
          }
        }
      }

      // Re-attach listeners in case focus changed
      const canvasRef = this.canvasView?.canvas;
      if (canvasRef && canvasRef.nodes) {
        setTimeout(() => {
          this.attachNodeEventListeners(canvasRef);
        }, 300);
      }
    } catch (error) {
      console.error('[Open Tabs Canvas] Navigation error:', error);
      new Notice('Error navigating to file. Check console for details.');
    }
  }

  /**
   * Cleanup listeners when canvas is closed
   */
  cleanup(canvasPath?: string) {
    if (canvasPath) {
      this.cleanupInstance(canvasPath);
      return;
    }
    if (this.canvasClickRef) {
      (this.app.workspace as any).offref(this.canvasClickRef);
      this.canvasClickRef = null;
    }
    if (this.canvasChangeRef) {
      (this.app.workspace as any).offref(this.canvasChangeRef);
      this.canvasChangeRef = null;
    }
    this.eventHandlers.clear();
    this.allCanvases.clear();
    this.canvasView = null;
    this.activeCanvasFile = null;
  }

  private cleanupInstance(canvasPath: string) {
    this.allCanvases.delete(canvasPath);
    if (this.allCanvases.size === 0 && this.canvasClickRef) {
      (this.app.workspace as any).offref(this.canvasClickRef);
      this.canvasClickRef = null;
      this.eventHandlers.clear();
      console.log('[Open Tabs Canvas] All canvas instances closed, listeners cleaned up');
    }
  }
}
