declare module "qrcode" {
  const QRCode: {
    create: (
      text: string,
      options?: { errorCorrectionLevel?: string },
    ) => { modules: { size: number; get: (x: number, y: number) => boolean } };
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
