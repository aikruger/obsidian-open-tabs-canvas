import { ItemView } from 'obsidian';

declare module 'obsidian' {
  export class CanvasView extends ItemView {
    readonly canvas: any;
    getViewType(): string;
    getDisplayText(): string;
  }
}
