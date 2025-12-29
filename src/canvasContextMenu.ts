import { App, TFile, Notice, Menu } from 'obsidian';

/**
 * Handles right-click context menus on canvas
 * Provides options to open all/selected file cards in background
 *
 * USER WORKFLOW:
 * 1. User right-clicks on canvas
 * 2. Menu appears with options:
 *    - "Open all 12 files in background"
 *    - "Open 3 selected files in background" (if any selected)
 *    - "Canvas Info"
 * 3. User clicks option
 * 4. Files open in background tabs
 */
export class CanvasContextMenuHandler {
  private app: App;
  private plugin: any;

  constructor(app: App, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * Setup right-click context menu on canvas
   *
   * EVENT FLOW:
   * 1. User right-clicks canvas → contextmenu event fires
   * 2. Extract file nodes and selected nodes from canvas
   * 3. Build menu with relevant options
   * 4. Show menu at click position
   */
  setupCanvasContextMenu(canvasFile: TFile, leaf: any) {
    // ✅ ADD THIS:
    if (!this.plugin || !this.plugin.settings.enableBatchOperations) {
      console.log("[Open Tabs Canvas] Batch operations disabled in settings");
      return;
    }

    const canvasView = leaf.view;
    if (!canvasView?.canvas?.containerEl) {
      console.warn('[Open Tabs Canvas] Canvas container not found');
      return;
    }

    const canvasContainer = canvasView.canvas.containerEl;
    const canvas = canvasView.canvas;

    // Right-click event listener
    canvasContainer.addEventListener('contextmenu', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Collect file nodes from canvas
      const selectedFileNodes = this.getSelectedFileNodes(canvas);
      const allFileNodes = this.getAllFileNodes(canvas);

      // Create context menu
      const menu = new Menu();

      // ─────────────────────────────────────────────────────────────
      // MENU OPTION 1: Open all file cards
      // ─────────────────────────────────────────────────────────────
      if (allFileNodes.length > 0) {
        menu.addItem((item) => {
          item
            .setTitle(
              `Open all ${allFileNodes.length} files in background`
            )
            .setIcon('arrow-up-right')
            .onClick(async () => {
              await this.openFilesInBackground(allFileNodes);
              new Notice(
                `Opened ${allFileNodes.length} files in background`
              );
              console.log(
                `[Open Tabs Canvas] Opened ${allFileNodes.length} files`
              );
            });
        });
      }

      // ─────────────────────────────────────────────────────────────
      // MENU OPTION 2: Open selected file cards
      // Only show if some (but not all) nodes are selected
      // ─────────────────────────────────────────────────────────────
      if (
        selectedFileNodes.length > 0 &&
        selectedFileNodes.length < allFileNodes.length
      ) {
        menu.addItem((item) => {
          item
            .setTitle(
              `Open ${selectedFileNodes.length} selected files in background`
            )
            .setIcon('arrow-up-right')
            .onClick(async () => {
              await this.openFilesInBackground(selectedFileNodes);
              new Notice(
                `Opened ${selectedFileNodes.length} files in background`
              );
              console.log(
                `[Open Tabs Canvas] Opened ${selectedFileNodes.length} selected files`
              );
            });
        });
      }

      // Add separator if we have file options
      if (allFileNodes.length > 0) {
        menu.addSeparator();
      }

      // ─────────────────────────────────────────────────────────────
      // MENU OPTION 3: Canvas Info (always available)
      // ─────────────────────────────────────────────────────────────
      menu.addItem((item) => {
        item
          .setTitle('Canvas Info')
          .setIcon('info')
          .onClick(() => {
            const info = `
Canvas: ${canvasFile.name}
File Cards: ${allFileNodes.length}
Selected: ${selectedFileNodes.length}
            `.trim();
            new Notice(info);
            console.log(
              `[Open Tabs Canvas] Canvas Info: ${allFileNodes.length} files, ` +
              `${selectedFileNodes.length} selected`
            );
          });
      });

      // Show the menu at mouse position
      menu.showAtPosition({ x: e.clientX, y: e.clientY });

    }, false);

    console.log(
      '[Open Tabs Canvas] ✓ Canvas context menu listener initialized'
    );
  }

  public getAllFileNodes(
    canvas: any
  ): Array<{ file: TFile; nodeView: any }> {
    const fileNodes: Array<{ file: TFile; nodeView: any }> = [];

    if (!canvas.nodes || canvas.nodes.size === 0) {
      return fileNodes;
    }

    // Iterate through all nodes in canvas
    canvas.nodes.forEach((nodeView: any) => {
      const filePath = this.extractFilePath(nodeView);

      if (filePath) {
        // Get file from vault
        const file = this.app.vault.getAbstractFileByPath(filePath);

        // Only include valid TFile objects (not folders)
        if (file && file instanceof TFile) {
          fileNodes.push({ file, nodeView });
        }
      }
    });

    console.log(
      `[Open Tabs Canvas] Found ${fileNodes.length} file nodes in canvas`
    );
    return fileNodes;
  }

  public getSelectedFileNodes(
    canvas: any
  ): Array<{ file: TFile; nodeView: any }> {
    const selectedNodes: Array<{ file: TFile; nodeView: any }> = [];

    if (!canvas.nodes || canvas.nodes.size === 0) {
      return selectedNodes;
    }

    canvas.nodes.forEach((nodeView: any) => {
      const nodeElement = nodeView.nodeEl;

      // Check if this node has the selection indicator class
      if (nodeElement?.classList?.contains('is-selected')) {
        const filePath = this.extractFilePath(nodeView);

        if (filePath) {
          const file = this.app.vault.getAbstractFileByPath(filePath);

          if (file && file instanceof TFile) {
            selectedNodes.push({ file, nodeView });
          }
        }
      }
    });

    console.log(
      `[Open Tabs Canvas] Found ${selectedNodes.length} selected file nodes`
    );
    return selectedNodes;
  }

  /**
   * Extract file path from node object
   *
   * HANDLES:
   * - nodeView.file (direct string path)
   * - nodeView.data.file (nested in data object)
   * - nodeView.file.path (file object with path property)
   *
   * DEFENSIVE:
   * - Type checks each property
   * - Returns null if not found or invalid
   */
  private extractFilePath(nodeView: any): string | null {
    // Try nodeView.file
    const raw = nodeView.file || nodeView.data?.file;

    // If it's a string, return it directly
    if (typeof raw === 'string') {
      return raw;
    }

    // If it's an object with a path property, return the path
    if (raw && typeof raw === 'object' && typeof raw.path === 'string') {
      return raw.path;
    }

    return null;
  }

  /**
   * Open multiple files in background tabs
   *
   * PROCESS:
   * 1. For each file:
   *    a. Check if already open
   *    b. If open, skip (avoid duplicate tabs)
   *    c. If not open, create new tab with active: false
   * 2. Show notice with count
   * 3. Handle errors gracefully (one failure doesn't block others)
   */
  async openFilesInBackground(fileNodes: Array<{ file: TFile; nodeView: any }>) {
    const workspace = this.app.workspace;
    let successCount = 0;

    // Show progress for >5 files
    let progressNotice: Notice | null = null;
    if (fileNodes.length > 5) {
      progressNotice = new Notice(`Opening 0/${fileNodes.length} files...`, 0);
    }

    for (let i = 0; i < fileNodes.length; i++) {
      const { file } = fileNodes[i];

      try {
        const existingLeaves = workspace.getLeavesOfType('markdown');
        const existingLeaf = existingLeaves.find(
          (leaf) => (leaf.view as any)?.file?.path === file.path
        );

        if (existingLeaf) {
          console.log(`[Tabs to Canvas] File already open, skipping: ${file.path}`);
          continue;
        }

        const newLeaf = workspace.getLeaf('tab');
        await newLeaf.openFile(file, { active: false });
        successCount++;

        // Update progress
        if (progressNotice) {
          progressNotice.setMessage(`Opening ${successCount}/${fileNodes.length} files...`);
        }

        console.log(`[Tabs to Canvas] ✓ Opened: ${file.path}`);
      } catch (error) {
        console.error(`[Tabs to Canvas] Error opening ${file.path}:`, error);
      }
    }

    if (progressNotice) {
      progressNotice.hide();
    }

    new Notice(`Opened ${successCount}/${fileNodes.length} files in background`);
    console.log(`[Tabs to Canvas] Batch operation complete: ${successCount} files opened`);
  }

  /**
   * Cleanup: remove event listeners
   */
  cleanup() {
    console.log(
      '[Open Tabs Canvas] Canvas context menu handler cleaned up'
    );
  }
}
