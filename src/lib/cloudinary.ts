import { v2 as cloudinary } from "cloudinary";

let isConfigured = false;

export function ensureCloudinaryConfig() {
  if (!isConfigured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLIENT_NAME || "dzkk7ubqq",
      api_key: process.env.CLOUDINARY_CLIENT_API || "889131577884438",
      api_secret:
        process.env.CLOUDINARY_CLIENT_SECRET || "AVh8qLZkL5EFPlkHdmc78YqGNmI",
      secure: true,
    });
    isConfigured = true;
  }
  return cloudinary;
}

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  options: {
    folder?: string;
    mimeType?: string;
    fileName?: string;
    resourceType?: "image" | "raw" | "auto";
  } = {}
): Promise<{
  secure_url: string;
  public_id: string;
  resource_type: string;
  bytes: number;
  pages?: number;
}> {
  const cld = ensureCloudinaryConfig();
  const mime = options.mimeType || "application/octet-stream";
  const base64 = buffer.toString("base64");
  const dataUri = `data:${mime};base64,${base64}`;

  // Images and PDFs uploaded as 'auto' or 'image' allow preview; Word docs use 'raw'
  const isDocxOrRaw =
    mime.includes("word") ||
    mime.includes("officedocument") ||
    mime.includes("msword");

  const resourceType =
    options.resourceType || (isDocxOrRaw ? "raw" : "auto");

  const result = await cld.uploader.upload(dataUri, {
    folder: options.folder || "signdocs_kyc",
    resource_type: resourceType,
  });

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
    bytes: result.bytes || buffer.length,
    pages: (result as any).pages || 1,
  };
}

export async function uploadDataUrlToCloudinary(
  dataUrl: string,
  folder = "signdocs_kyc"
): Promise<{
  secure_url: string;
  public_id: string;
  resource_type: string;
  bytes: number;
}> {
  const cld = ensureCloudinaryConfig();
  const result = await cld.uploader.upload(dataUrl, {
    folder,
    resource_type: "auto",
  });
  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
    bytes: result.bytes || 0,
  };
}

export function parseCloudinaryUrl(url?: string | null) {
  if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) {
    return null;
  }
  try {
    const cleanUrl = url.split("#")[0].split("?")[0];
    const parsed = new URL(cleanUrl);
    const segments = parsed.pathname.split("/").filter(Boolean);
    const resourceType = segments[1] || "image";
    const deliveryType = segments[2] || "upload";

    const versionIndex = segments.findIndex((seg) => /^v\d+$/.test(seg));
    const assetSegments =
      versionIndex !== -1 ? segments.slice(versionIndex + 1) : segments.slice(3);

    if (!assetSegments.length) return null;

    const lastSegment = assetSegments[assetSegments.length - 1];
    const dotIndex = lastSegment.lastIndexOf(".");
    const format =
      dotIndex > 0 ? lastSegment.slice(dotIndex + 1).toLowerCase() : null;

    let publicId: string;
    if (resourceType === "raw") {
      publicId = assetSegments.join("/");
    } else {
      const withoutExt =
        dotIndex > 0 ? lastSegment.slice(0, dotIndex) : lastSegment;
      publicId = [...assetSegments.slice(0, -1), withoutExt].join("/");
    }

    return {
      resourceType,
      deliveryType,
      publicId: decodeURIComponent(publicId),
      format,
    };
  } catch {
    return null;
  }
}

export async function deleteFromCloudinary(
  publicIdOrUrl?: string | null,
  resourceType: "image" | "raw" | "video" = "image"
) {
  if (!publicIdOrUrl) return;
  const cld = ensureCloudinaryConfig();
  try {
    const parsed = parseCloudinaryUrl(publicIdOrUrl);
    const targetId = parsed?.publicId || publicIdOrUrl;
    const targetType = (parsed?.resourceType as any) || resourceType;
    await cld.uploader.destroy(targetId, { resource_type: targetType });
  } catch (err) {
    console.error("Cloudinary delete warning:", err);
  }
}
