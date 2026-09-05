export const REQUEST_FILE_MAX_BYTES = 25 * 1024 * 1024;
export const REQUEST_FILE_MAX_COUNT = 5;

const ALLOWED_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "gif",
  "zip",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
] as const;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

export const REQUEST_FILE_ACCEPT = [
  "image/*",
  "application/pdf",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ...ALLOWED_EXTENSIONS.map((ext) => `.${ext}`),
].join(",");

export type RequestFileError =
  | "type"
  | "size"
  | "count"
  | "empty";

export function fileExtension(name: string): string {
  const parts = name.trim().toLowerCase().split(".");
  return parts.length > 1 ? (parts.at(-1) ?? "") : "";
}

export function isAllowedRequestFile(name: string, mimeType?: string): boolean {
  const ext = fileExtension(name);
  if ((ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) return true;
  return Boolean(mimeType && ALLOWED_MIME_TYPES.has(mimeType));
}

export function validateRequestFile(file: { name: string; size: number; type?: string }): RequestFileError | null {
  if (!file.name.trim()) return "empty";
  if (file.size > REQUEST_FILE_MAX_BYTES) return "size";
  if (!isAllowedRequestFile(file.name, file.type)) return "type";
  return null;
}
