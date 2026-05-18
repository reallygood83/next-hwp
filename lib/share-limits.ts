export const SHARE_SIZE_LIMIT_MB = 15;
export const SHARE_SIZE_LIMIT_BYTES = SHARE_SIZE_LIMIT_MB * 1024 * 1024;

export function formatShareSize(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
