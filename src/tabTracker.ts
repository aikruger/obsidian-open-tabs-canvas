import { App, TFile, WorkspaceLeaf } from 'obsidian';

export interface TabInfo {
  leaf: WorkspaceLeaf;
  file: TFile;
  displayName: string;
  filePath: string;
  icon: string;
}

export default class TabTracker {
  constructor(private app: App) {}

  getAllOpenTabs(): TabInfo[] {
    const tabs: TabInfo[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view as any;
      if (view.getViewType() !== 'empty' && view.file) {
        tabs.push({
          leaf,
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
