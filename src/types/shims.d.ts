declare module "jsqr" {
  interface QRCode {
    data: string;
  }
  interface Options {
    inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst";
  }
  export default function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
    options?: Options,
  ): QRCode | null;
}

declare module "jpeg-js" {
  export function decode(
    data: Uint8Array | Buffer,
    options?: { maxMemoryUsageInMB?: number },
  ): { data: Uint8Array; width: number; height: number };
}
