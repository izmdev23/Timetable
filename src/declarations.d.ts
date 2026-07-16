declare module 'docx-preview' {
  export interface Options {
    className?: string;
    inWrapper?: boolean;
    ignoreWidth?: boolean;
    ignoreHeight?: boolean;
    breakPages?: boolean;
    debug?: boolean;
    experimental?: boolean;
    [key: string]: any;
  }
  export function renderAsync(
    data: Blob | ArrayBuffer | Uint8Array,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement,
    options?: Options
  ): Promise<any>;
}
