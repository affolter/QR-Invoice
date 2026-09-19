declare module "qrcode" {
  const QRCode: {
    toBuffer: (text: string, options?: Record<string, unknown>) => Promise<Buffer>;
  };
  export default QRCode;
}

declare module "jsqr" {
  function jsQR(
    data: Uint8ClampedArray,
    width: number,
    height: number,
  ): { data: string } | null;
  export default jsQR;
}
