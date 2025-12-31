import { App, PluginSettingTab, Setting } from 'obsidian';
import OpenTabsCanvasPlugin from './main';

/**
 * User settings interface
 * These control which features are enabled and how they behave
 */
export interface OpenTabsCanvasSettings {
  // Feature toggles
  autoActivateOnAllCanvases: boolean;    // Auto-enable on any canvas open
  enableHighlighting: boolean;            // Active tab glow effect
  showNavigationHints: boolean;            // "Alt + Double-click" tooltip
  enableBatchOperations: boolean;         // Right-click context menu
  enableSendTabToCanvas: boolean;

  // Layout settings (used when creating new canvases)
  cardSize: number;                       // Card width/height in pixels
  cardSpacing: number;                    // Gap between cards in pixels
  canvasOutputFolder: string;             // Default folder for new canvases
}

/**
 * Default settings - these are used if user has never configured anything
 */
export const DEFAULT_SETTINGS: OpenTabsCanvasSettings = {
  autoActivateOnAllCanvases: true,        // Users expect it to work on all canvases
  cardSize: 250,                          // Matches existing default
  cardSpacing: 50,                        // Matches existing default
  enableHighlighting: true,               // Important for UX
  showNavigationHints: true,              // Helps users discover feature
  enableBatchOperations: true,             // Useful for power users
  enableSendTabToCanvas: true,
  canvasOutputFolder: "/Sensemaking/",     // Default folder for new canvases
};

/**
 * Settings Panel UI
 *
 * ORGANIZATION:
 * 1. Feature Toggles section - Turn features on/off
 * 2. Layout Configuration section - Customize appearance
 */
export class OpenTabsCanvasSettingTab extends PluginSettingTab {
  plugin: OpenTabsCanvasPlugin;

  constructor(app: App, plugin: OpenTabsCanvasPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Open Tabs to Canvas Settings' });

    // ═══════════════════════════════════════════════════════════════
    // SECTION 1: Feature Toggles
    // ═══════════════════════════════════════════════════════════════
    containerEl.createEl('h3', { text: 'Feature Toggles' });

    new Setting(containerEl)
      .setName('Auto-activate on all canvases')
      .setDesc(
        'Automatically enable interactive features when opening ANY canvas ' +
        'with file cards (including old/manually-created canvases)'
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.autoActivateOnAllCanvases)
          .onChange(async (value) => {
            this.plugin.settings.autoActivateOnAllCanvases = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Enable "Add to canvas" hotkey')
      .setDesc('Show modal to add current file to any canvas')
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableSendTabToCanvas)
          .onChange(async (value) => {
            this.plugin.settings.enableSendTabToCanvas = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Enable active tab highlighting')
      .setDesc(
        'Highlight canvas nodes matching the currently active file ' +
        '(shown with teal glow effect)'
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableHighlighting)
          .onChange(async (value) => {
            this.plugin.settings.enableHighlighting = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Enable navigation hints')
      .setDesc(
        'Show "Alt + Double-click to open file" tooltip when hovering over cards'
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.showNavigationHints)
          .onChange(async (value) => {
            this.plugin.settings.showNavigationHints = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Enable batch file operations')
      .setDesc(
        'Right-click canvas to see menu options for opening all or selected ' +
        'file cards in background'
      )
      .addToggle(toggle =>
        toggle
          .setValue(this.plugin.settings.enableBatchOperations)
          .onChange(async (value) => {
            this.plugin.settings.enableBatchOperations = value;
            await this.plugin.saveSettings();
          })
      );

    // ═══════════════════════════════════════════════════════════════
    // SECTION 2: Layout Configuration
    // ═══════════════════════════════════════════════════════════════
    containerEl.createEl('h3', { text: 'Canvas Layout Configuration' });

    new Setting(containerEl)
      .setName('Default card width/height (pixels)')
      .setDesc(
        'Size of file cards when creating new canvases with the command'
      )
      .addSlider(slider =>
        slider
          .setLimits(150, 400, 10)
          .setValue(this.plugin.settings.cardSize)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.cardSize = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName('Card spacing (pixels)')
      .setDesc(
        'Horizontal and vertical distance between cards in the grid layout'
      )
      .addSlider(slider =>
        slider
          .setLimits(20, 100, 5)
          .setValue(this.plugin.settings.cardSpacing)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.cardSpacing = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Canvas output folder")
      .setDesc("Default folder for new canvases (supports nested paths like /Projects/Canvases/)",)
      .addText(text =>
        text
          .setPlaceholder("/Sensemaking/")
          .setValue(this.plugin.settings.canvasOutputFolder)
          .onChange(async (value) => {
            // Normalize path: ensure starts with / and doesn't end with /
            const normalized = value.startsWith("/") ? value : "/" + value;
            const trimmed = normalized.endsWith("/") && normalized.length > 1 
              ? normalized.slice(0, -1) 
              : normalized;
            
            this.plugin.settings.canvasOutputFolder = trimmed;
            await this.plugin.saveSettings();
          })
      );
  }
}
