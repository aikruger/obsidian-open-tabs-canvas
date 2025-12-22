/**
 * CanvasSelector Modal
 * Shows user a filterable list of canvases to add current tab to
 */

import { App, FuzzyMatch, FuzzySuggestModal, TFile, Notice } from 'obsidian';

interface CanvasWithLastFocus {
  file: TFile;
  name: string;
  lastModified: number;
  lastFocusPoint: { x: number; y: number } | null;
}

export class CanvasSelectorModal extends FuzzySuggestModal<CanvasWithLastFocus> {
  canvases: CanvasWithLastFocus[] = [];
  currentFile: TFile;
  onSelect: (canvas: CanvasWithLastFocus) => Promise<void>;

  constructor(
    app: App,
    currentFile: TFile,
    canvases: CanvasWithLastFocus[],
    onSelect: (canvas: CanvasWithLastFocus) => Promise<void>
  ) {
    super(app);
    this.currentFile = currentFile;
    this.canvases = canvases;
    this.onSelect = onSelect;
  }

  getItems(): CanvasWithLastFocus[] {
    // Sort: recently modified first
    return this.canvases.sort((a, b) => b.lastModified - a.lastModified);
  }

  getItemText(item: CanvasWithLastFocus): string {
    return item.name;
  }

  async onChooseItem(
    item: CanvasWithLastFocus,
    evt: MouseEvent | KeyboardEvent
  ): Promise<void> {
    await this.onSelect(item);
  }

  renderSuggestion(match: FuzzyMatch<CanvasWithLastFocus>, el: HTMLElement): void {
    const { item, match: matchStr } = match;
    const lastModDate = new Date(item.lastModified).toLocaleDateString();

    el.createEl('div', { text: item.name });
    el.createEl('small', {
      text: `Modified: ${lastModDate}`,
      cls: 'mod-dim'
    });
  }
}