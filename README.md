# Open Tabs to Canvas

This Obsidian plugin allows you to quickly create a canvas from all your open tabs, and adds several features to make canvases more interactive and synchronized with your workspace.

## Features

-   **Open Tabs to Canvas**: A command to create a new canvas with all your open tabs as file cards.
-   **Universal Canvas Activation**: Automatically enables interactive features on any canvas containing file cards, not just those created by the plugin. This can be toggled in the settings.
-   **Active Tab Synchronization**:
    -   **Active Tab Highlighting**: The canvas card corresponding to your currently focused tab glows brightly.
    -   **Background Tab Scanning**: Canvas cards corresponding to other open background tabs are highlighted with a dimmer glow.
    -   **Scan Command**: Run "Canvas: Scan and highlight all open tabs" to manually refresh the status of all open tabs against the current canvas.
-   **Canvas Context Menu**: Right-click on a canvas to open all or only selected files in the background.
-   **Add Current File to Canvas**: A command "Add current file to canvas..." to easily add the currently open file to an existing canvas.

## How to Use

### Creating a Canvas from Open Tabs

1.  Open multiple tabs in Obsidian.
2.  Run the command "Open Tabs to Canvas" from the command palette.
3.  A new canvas will be created with each open tab represented as a file card.

### Interacting with Canvases

-   **Open File**: Hold `Alt` and double-click a file card to open the corresponding file.
-   **Visual Synchronization**:
    -   When you switch tabs, the corresponding node on the canvas will light up.
    -   Files open in background tabs are marked with a subtle highlight so you can see at a glance what is open.
-   **Add File to Canvas**: Use the command "Add current file to canvas..." to add the active file to a canvas of your choice.
-   **Batch Open Files**: Right-click on the canvas to open all or selected files in the background.

## Settings

-   **Auto-activate on all canvases**: Automatically enable interactive features when opening any canvas with file cards.
-   **Enable "Add to canvas" hotkey**: Show modal to add current file to any canvas.
-   **Enable active tab highlighting**: Highlight canvas nodes matching the currently active file (teal glow effect).
-   **Enable navigation hints**: Show "Alt + Double-click to open file" tooltip when hovering over cards.
-   **Enable batch file operations**: Right-click canvas to see menu options for opening all or selected file cards in background.
-   **Default card width/height (pixels)**: Size of file cards when creating new canvases with the command.
-   **Card spacing (pixels)**: Horizontal and vertical distance between cards in the grid layout.

## Manually installing the plugin

-   Copy over `main.js`, `styles.css`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/your-plugin-id/`.
