export interface IRendererConfig {
  canvas: HTMLCanvasElement;
  fontFamily?: string;
  fontSize?: number;
}

export interface IBridgeConfig {
  url: string;
  token?: string;
}
