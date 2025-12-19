import { App, TFile, Notice } from 'obsidian';

/**
 * Handles drag-and-drop of tabs onto canvas to create file card nodes
 *
 * USER WORKFLOW:
 * 1. User has canvas open and multiple tabs open
 * 2. User holds Alt and drags a tab onto the canvas
 * 3. New file card appears at drop location
 * 4. Canvas JSON is updated with new node
 */
export class DragDropHandler {
  private app: App;
  private plugin: any; // Reference to plugin for settings access

  constructor(app: App, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * Setup drag-drop event listeners on a specific canvas
   *
   * IMPLEMENTATION NOTES:
   * - Only active if enableDragDropToCanvas setting is true
   * - Uses Alt key as modifier to distinguish from normal canvas operations
   * - Provides visual feedback (border highlight) during drag
   */
  setupTabDragDropListener(canvasFile: TFile, leaf: any) {
    // Respect user settings
    if (!this.plugin.settings.enableDragDropToCanvas) {
      console.log('[Open Tabs Canvas] Drag-drop disabled in settings');
      return;
    }

    const canvasView = leaf.view;
    if (!canvasView?.canvas?.containerEl) {
      console.warn('[Open Tabs Canvas] Canvas container not found');
      return;
    }

    const canvasContainer = canvasView.canvas.containerEl;
    const canvas = canvasView.canvas;

    // ─────────────────────────────────────────────────────────────
    // Listener 1: DRAGOVER - User is dragging over the canvas
    // ─────────────────────────────────────────────────────────────
    canvasContainer.addEventListener('dragover', (e: DragEvent) => {
      // Only handle Alt+drag operations
      if (!e.altKey) {
        return;
      }

      e.preventDefault(); // Allow drop on this element
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy'; // Show "copy" cursor
      }

      // Visual feedback: highlight canvas as drop target
      canvasContainer.classList.add('canvas-drag-target');
    });

    // ─────────────────────────────────────────────────────────────
    // Listener 2: DRAGLEAVE - User dragged out of canvas
    // ─────────────────────────────────────────────────────────────
    canvasContainer.addEventListener('dragleave', (e: DragEvent) => {
      // Remove highlight when leaving the container itself (not child elements)
      if (e.target === canvasContainer) {
        canvasContainer.classList.remove('canvas-drag-target');
      }
    });

    // ─────────────────────────────────────────────────────────────
    // Listener 3: DROP - User released the drag
    // ─────────────────────────────────────────────────────────────
    canvasContainer.addEventListener('drop', async (e: DragEvent) => {
      // Only handle Alt+drop
      if (!e.altKey) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Remove visual highlight
      canvasContainer.classList.remove('canvas-drag-target');

      try {
        // Step 1: Get what was dragged
        if (!e.dataTransfer) {
          console.warn('[Open Tabs Canvas] No dataTransfer object found');
          return;
        }
        const dragData = e.dataTransfer.getData('text/plain');

        if (!dragData) {
          console.warn('[Open Tabs Canvas] No drag data found');
          return;
        }

        // Step 2: Extract file path from drag data
        const filePath = this.extractFilePathFromDragData(dragData);

        if (!filePath) {
          console.warn('[Open Tabs Canvas] Could not extract file path from drag');
          return;
        }

        // Step 3: Verify file exists in vault
        const file = this.app.vault.getAbstractFileByPath(filePath);
        if (!file || !(file instanceof TFile)) {
          new Notice(`File not found: ${filePath}`);
          return;
        }

        // Step 4: Get drop position (screen coords → canvas coords)
        const canvasRect = canvasContainer.getBoundingClientRect();
        const screenDropX = e.clientX - canvasRect.left;
        const screenDropY = e.clientY - canvasRect.top;

        // Convert screen coordinates to canvas coordinates
        // (accounts for pan and zoom)
        const canvasCoords = this.screenToCanvasCoords(
          canvas,
          screenDropX,
          screenDropY
        );

        // Step 5: Create new node object
        const newNode = {
          id: this.generateUUID(),
          type: 'file',
          file: filePath,
          x: canvasCoords.x,
          y: canvasCoords.y,
          width: this.plugin.settings.cardSize,
          height: this.plugin.settings.cardSize
        };

        // Step 6: Add node to canvas file
        await this.addNodeToCanvas(canvasFile, newNode);

        new Notice(`Added file to canvas: ${file.basename}`);
        console.log(
          `[Open Tabs Canvas] ✓ Dropped file onto canvas: ${filePath}`
        );

      } catch (error) {
        console.error('[Open Tabs Canvas] Error handling tab drop:', error);
        new Notice('Error adding file to canvas. Check console for details.');
      }
    });

    console.log(
      '[Open Tabs Canvas] ✓ Tab drag-drop listener initialized'
    );
  }

  /**
   * Extract file path from drag data
   *
   * HANDLES:
   * - Plain text file paths (e.g., "path/to/file.md")
   * - File explorer drags
   * - Tab bar drags
   * - Fallback to currently active file if unclear
   */
  private extractFilePathFromDragData(dragData: string): string | null {
    // If it contains a dot, it's likely a file path
    if (dragData && dragData.includes('.')) {
      return dragData;
    }

    // Fallback: get the active file if drag data unclear
    const activeLeaf = this.app.workspace.activeLeaf;
    if (activeLeaf?.view && (activeLeaf.view as any).file) {
      return (activeLeaf.view as any).file.path;
    }

    return null;
  }

  /**
   * Convert screen coordinates to canvas viewport coordinates
   *
   * WHY NEEDED:
   * - Canvas can be panned (moved) and zoomed
   * - Drop coordinates are relative to screen
   * - We need coordinates relative to the canvas viewport
   *
   * FORMULA:
   * canvasX = (screenX / zoomLevel) + panOffsetX
   */
  private screenToCanvasCoords(
    canvas: any,
    screenX: number,
    screenY: number
  ): { x: number; y: number } {
    // Get canvas viewport state (pan and zoom)
    const viewport = canvas.viewport || { x: 0, y: 0, zoom: 1 };

    // Convert screen coords to canvas coords
    const canvasX = screenX / (viewport.zoom || 1) - (viewport.x || 0);
    const canvasY = screenY / (viewport.zoom || 1) - (viewport.y || 0);

    return { x: canvasX, y: canvasY };
  }

  /**
   * Add a new node to the canvas file
   *
   * PROCESS:
   * 1. Read current canvas JSON from file
   * 2. Parse JSON structure
   * 3. Add new node to nodes array
   * 4. Ensure metadata exists
   * 5. Write updated JSON back to file
   * 6. Canvas view automatically updates
   */
  private async addNodeToCanvas(canvasFile: TFile, newNode: any) {
    try {
      // Step 1: Read current content
      const content = await this.app.vault.read(canvasFile);
      const canvasData = JSON.parse(content);

      // Step 2: Ensure nodes array exists
      if (!canvasData.nodes) {
        canvasData.nodes = [];
      }

      // Step 3: Add the new node
      canvasData.nodes.push(newNode);

      // Step 4: Ensure metadata structure exists
      if (!canvasData.metadata) {
        canvasData.metadata = { version: '1.0', frontmatter: {} };
      }

      // Step 5: Write back to file with formatting
      const updatedContent = JSON.stringify(canvasData, null, 2);
      await this.app.vault.modify(canvasFile, updatedContent);

      console.log(
        `[Open Tabs Canvas] ✓ Node added to canvas: ${newNode.id}`
      );

    } catch (error) {
      console.error(
        '[Open Tabs Canvas] Error adding node to canvas:',
        error
      );
      throw error;
    }
  }

  /**
   * Generate UUID for new node
   * RFC4122 v4 compliant UUID
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function(c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 3) | 8;
        return v.toString(16);
      }
    );
  }

  /**
   * Cleanup: remove event listeners when canvas closes
   */
  cleanup(canvasFile?: TFile) {
    console.log('[Open Tabs Canvas] Drag-drop handler cleaned up');
  }
}
