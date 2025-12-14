import { Plugin, WorkspaceLeaf, Notice } from 'obsidian';
import { CanvasManager } from './canvasManager';
import { TabTracker } from './tabTracker';

// biome-ignore lint/suspicious/noExplicitAny: This is a direct workaround for the Obsidian API that is not yet fully typed.
type CanvasView = any;
// biome-ignore lint/suspicious/noExplicitAny: This is a direct workaround for the Obsidian API that is not yet fully typed.
type CanvasNode = any;

export default class OpenTabsCanvasPlugin extends Plugin {
  canvasManager: CanvasManager;
  tabTracker: TabTracker;
  activeNodeId: string | null = null;

  async onload() {
    this.tabTracker = new TabTracker(this.app);
    this.canvasManager = new CanvasManager(this.app);

    this.addCommand({
      id: 'open-tabs-to-canvas',
      name: 'Open Tabs to Canvas',
      callback: () => {
        const tabs = this.tabTracker.getAllOpenTabs();
        if (tabs.length > 0) {
          this.canvasManager.createCanvasFromOpenTabs(tabs);
          new Notice('Canvas created from open tabs.');
        } else {
          new Notice('No open tabs to create a canvas from.');
        }
      },
    });

    this.registerEvent(
      this.app.workspace.on('active-leaf-change', this.handleActiveLeafChange.bind(this))
    );

    this.registerDomEvent(document, 'dblclick', this.handleCanvasNodeDblClick.bind(this));
  }

  handleActiveLeafChange(leaf: WorkspaceLeaf | null) {
    // biome-ignore lint/suspicious/noExplicitAny: This is a direct workaround for the Obsidian API that is not yet fully typed.
    const canvasView: CanvasView = this.app.workspace.getActiveViewOfType('canvas' as any);
    // biome-ignore lint/suspicious/noExplicitAny: This is a direct workaround for the Obsidian API that is not yet fully typed.
    const view = leaf?.view as any;
    if (!leaf || !canvasView || !view?.file) {
      return;
    }

    const file = view.file;
    // biome-ignore lint/suspicious/noExplicitAny: This is a direct workaround for the Obsidian API that is not yet fully typed.
    const canvasData = (canvasView.canvas as any).getData();

    const targetNode = canvasData.nodes.find(
      (node: { type: string, file: string }) => node.type === 'file' && node.file === file.path
    );

    this.updateNodeHighlighting(canvasView, targetNode?.id || null);
  }

  updateNodeHighlighting(canvasView: CanvasView, targetNodeId: string | null) {
    if (this.activeNodeId) {
      // biome-ignore lint/suspicious/noExplicitAny: This is a direct workaround for the Obsidian API that is not yet fully typed.
      const oldNodeEl = (canvasView.canvas as any).nodes.get(this.activeNodeId)?.nodeEl;
      if (oldNodeEl) {
        oldNodeEl.removeClass('is-active-tab');
      }
    }

    if (targetNodeId) {
      // biome-ignore lint/suspicious/noExplicitAny: This is a direct workaround for the Obsidian API that is not yet fully typed.
      const newNodeEl = (canvasView.canvas as any).nodes.get(targetNodeId)?.nodeEl;
      if (newNodeEl) {
        newNodeEl.addClass('is-active-tab');
      }
    }

    this.activeNodeId = targetNodeId;
  }

  handleCanvasNodeDblClick(evt: MouseEvent) {
    if (!evt.altKey) {
      return;
    }

    const nodeEl = (evt.target as HTMLElement).closest('.canvas-node');
    if (!nodeEl) {
      return;
    }

    const nodeId = (nodeEl as HTMLElement).dataset.id;
    if (!nodeId) {
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: This is a direct workaround for the Obsidian API that is not yet fully typed.
    const canvasView: CanvasView = this.app.workspace.getActiveViewOfType('canvas' as any);
    if (!canvasView) {
      return;
    }

    // biome-ignore lint/suspicious/noExplicitAny: This is a direct workaround for the Obsidian API that is not yet fully typed.
    const canvasData = (canvasView.canvas as any).getData();
    const targetNode = canvasData.nodes.find((node: { id: string }) => node.id === nodeId);

    if (targetNode && targetNode.file) {
      evt.preventDefault();
      this.app.workspace.openLinkText(targetNode.file, '', false);
    }
  }

  onunload() {
    // All event listeners are cleaned up automatically by Obsidian
  }
}
