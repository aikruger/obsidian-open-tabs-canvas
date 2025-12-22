/**
 * Canvas Info Tracker
 * Tracks last focus point and modification time for each canvas
 */

import { App, TFile } from 'obsidian';

export interface CanvasViewState {
  lastFocusPoint: { x: number; y: number } | null;
  lastModified: number;
}

export class CanvasInfoTracker {
  private app: App;
  private canvasStates: Map<string, CanvasViewState> = new Map();

  constructor(app: App) {
    this.app = app;
    this.setupCanvasMonitoring();
  }

  /**
   * Setup listeners to track canvas interactions
   */
  private setupCanvasMonitoring(): void {
    this.app.workspace.on('file-open', (file: TFile | null) => {
      if (file && file.extension === 'canvas') {
        this.captureCanvasState(file);
      }
    });

    // Track viewport changes
    this.app.workspace.on('layout-change', () => {
      this.updateAllCanvasStates();
    });
  }

  /**
   * Capture the current focus point of a canvas
   * Focus point = center of the visible canvas viewport
   */
  private captureCanvasState(canvasFile: TFile): void {
    const leaves = this.app.workspace.getLeavesOfType('canvas');
    const leaf = leaves.find(
      (l) => (l.view as any)?.file?.path === canvasFile.path
    );

    if (!leaf) return;

    const canvasView = (leaf.view as any);
    if (!canvasView?.canvas?.viewport) {
      console.warn('[Canvas Info] No viewport found');
      return;
    }

    const viewport = canvasView.canvas.viewport;
    const focusPoint = {
      x: viewport.x || 0,
      y: viewport.y || 0,
    };

    this.canvasStates.set(canvasFile.path, {
      lastFocusPoint: focusPoint,
      lastModified: Date.now(),
    });

    console.log(`[Canvas Info] Captured state for ${canvasFile.name}:`, focusPoint);
  }

  /**
   * Update states for all open canvases
   */
  private updateAllCanvasStates(): void {
    const leaves = this.app.workspace.getLeavesOfType('canvas');
    leaves.forEach((leaf) => {
      const file = (leaf.view as any)?.file;
      if (file) {
        this.captureCanvasState(file);
      }
    });
  }

  /**
   * Get the last focus point for a canvas
   * Falls back to center (0, 0) if not recorded
   */
  getLastFocusPoint(canvasPath: string): { x: number; y: number } {
    const state = this.canvasStates.get(canvasPath);
    if (state?.lastFocusPoint) {
      // Offset by a grid spacing to position new node below last focus
      return {
        x: state.lastFocusPoint.x,
        y: state.lastFocusPoint.y + 300, // 300px below last focus
      };
    }
    return { x: 0, y: 0 };
  }

  /**
   * Get last modified time for sorting
   */
  getLastModified(canvasPath: string): number {
    return this.canvasStates.get(canvasPath)?.lastModified || 0;
  }

  /**
   * Get all canvas files with their info
   */
  getAllCanvases(): Array<{ file: TFile; lastModified: number; lastFocusPoint: { x: number; y: number } | null }> {
    const allFiles = this.app.vault.getMarkdownFiles()
      .filter((f) => f.extension === 'canvas') as TFile[];

    return allFiles.map((file) => {
      const state = this.canvasStates.get(file.path);
      return {
        file,
        lastModified: state?.lastModified || file.stat.mtime,
        lastFocusPoint: state?.lastFocusPoint || null,
      };
    });
  }
}