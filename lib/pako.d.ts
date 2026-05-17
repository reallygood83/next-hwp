declare module "pako" {
  const pako: {
    inflate(input: Uint8Array): Uint8Array;
    inflateRaw(input: Uint8Array): Uint8Array;
  };
  export default pako;
}
