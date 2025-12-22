# Open Tabs to Canvas

This Obsidian plugin allows you to quickly create a canvas from all your open tabs, and adds several features to make canvases more interactive.

## Features

-   **Open Tabs to Canvas**: A command to create a new canvas with all your open tabs as file cards.
-   **Universal Canvas Activation**: Automatically enables interactive features on any canvas containing file cards, not just those created by the plugin. This can be toggled in the settings.
-   **Alt+Drag Tab to Canvas**: Hold the `Alt` key and drag a tab from the tab bar onto a canvas to create a new file card for that file.
-   **Canvas Context Menu**: Right-click on a canvas to open all or only selected files in the background.

## How to Use

### Creating a Canvas from Open Tabs

1.  Open multiple tabs in Obsidian.
2.  Run the command "Open Tabs to Canvas" from the command palette.
3.  A new canvas will be created with each open tab represented as a file card.

### Interacting with Canvases

-   **Open File**: Hold `Alt` and double-click a file card to open the corresponding file.
-   **Add File to Canvas**: Hold `Alt` and drag a tab onto the canvas to create a new file card.
-   **Batch Open Files**: Right-click on the canvas to open all or selected files in the background.

## Settings

-   **Auto-activate on all canvases**: Automatically enable interactive features when opening any canvas with file cards.
-   **Enable active tab highlighting**: Highlight canvas nodes matching the currently active file.
-   **Enable navigation hints**: Show "Alt + Double-click to open file" tooltip when hovering over cards.
-   **Enable tab drag-drop to canvas**: Hold Alt and drag open tabs onto canvas to create new file cards.
-   **Enable batch file operations**: Right-click canvas to see menu options for opening all or selected file cards in background.
-   **Default card width/height (pixels)**: Size of file cards when creating new canvases with the command.
-   **Card spacing (pixels)**: Horizontal and vertical distance between cards in the grid layout.

## Manually installing the plugin

-   Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.
