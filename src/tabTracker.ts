import { App, TFile, WorkspaceLeaf } from 'obsidian';

export interface OpenTabInfo {
  leaf: WorkspaceLeaf;
  file: TFile | null;
  displayName: string;
  filePath: string;
  icon: string;
}

export class TabTracker {
  private app: App;

  constructor(app: App) {
    this.app = app;
  }

  getAllOpenTabs(): OpenTabInfo[] {
    const tabs: OpenTabInfo[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      // biome-ignore lint/suspicious/noExplicitAny: This is a direct workaround for the Obsidian API that is not yet fully typed.
      const view = leaf.view as any;
      if (view.getViewType() !== 'empty' && view.file) {
        tabs.push({
          leaf: leaf,
          file: view.file,
          displayName: leaf.getDisplayText(),
          filePath: view.file.path,
          icon: view.icon,
        });
      }
    });
    return tabs;
  }

}
