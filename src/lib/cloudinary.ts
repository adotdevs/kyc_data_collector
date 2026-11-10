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
  format?: string;
  bytes: number;
  pages?: number;
}> {
  const cld = ensureCloudinaryConfig();
  const mime = (options.mimeType || "application/octet-stream").toLowerCase();
  const lowerName = (options.fileName || "").toLowerCase();

  const isDocxOrRaw =
    mime.includes("word") ||
    mime.includes("officedocument") ||
    mime.includes("msword") ||
    lowerName.endsWith(".doc") ||
    lowerName.endsWith(".docx");

  const preferredType: "image" | "raw" | "auto" =
    options.resourceType || (isDocxOrRaw ? "raw" : "auto");

  const uploadViaStream = (
    resType: "image" | "raw" | "auto",
    customPublicId?: string
  ) =>
    new Promise<any>((resolve, reject) => {
      const uploadOpts: Record<string, any> = {
        folder: options.folder || "signdocs_kyc",
        resource_type: resType,
      };
      if (customPublicId) {
        uploadOpts.public_id = customPublicId;
      }
      const stream = cld.uploader.upload_stream(uploadOpts, (err, result) => {
        if (err || !result) return reject(err || new Error("Cloudinary upload failed"));
        resolve(result);
      });
      stream.end(buffer);
    });

  let result: any;
  try {
    const rawPublicId =
      preferredType === "raw" && options.fileName
        ? `${Date.now()}_${options.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`
        : undefined;
    result = await uploadViaStream(preferredType, rawPublicId);
  } catch {
    // Fallback to raw resource_type if auto/image fails (e.g. encrypted or special PDF)
    const ext = lowerName.endsWith(".pdf") || mime.includes("pdf") ? ".pdf" : "";
    const fallbackId = `doc_${Date.now()}${ext}`;
    result = await uploadViaStream("raw", fallbackId);
  }

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    resource_type: result.resource_type,
    format: result.format,
    bytes: result.bytes || buffer.length,
    pages: Number(result.pages) || 1,
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
  const parsed = parseCloudinaryUrl(publicIdOrUrl);
  const baseId = parsed?.publicId || publicIdOrUrl;
  const detectedType = (parsed?.resourceType as "image" | "raw" | "video") || resourceType;

  const typesToTry: Array<"image" | "raw"> =
    detectedType === "raw" ? ["raw", "image"] : ["image", "raw"];

  for (const rType of typesToTry) {
    try {
      await cld.uploader.destroy(baseId, {
        resource_type: rType,
        invalidate: true,
      });
    } catch {
      // ignore
    }
  }
}

export async function fetchCloudinaryAssetBuffer(
  url?: string | null,
  publicIdHint?: string | null
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!url && !publicIdHint) return null;

  // 1. Try direct fetch first if URL is HTTP(S)
  if (url && url.startsWith("http")) {
    try {
      const directRes = await fetch(url, { cache: "no-store" });
      if (directRes.ok) {
        const arr = await directRes.arrayBuffer();
        if (arr.byteLength > 0) {
          return {
            buffer: Buffer.from(arr),
            contentType:
              directRes.headers.get("content-type") || "application/octet-stream",
          };
        }
      }
    } catch {
      // fallback to Cloudinary signed private_download_url
    }
  }

  // 2. Fallback to Cloudinary private_download_url (required for PDFs when public PDF delivery is restricted)
  const parsed = parseCloudinaryUrl(url);
  const rawPublicId = (publicIdHint || parsed?.publicId || "").trim();
  if (!rawPublicId) return null;

  const cld = ensureCloudinaryConfig();
  const expiresAt = Math.floor(Date.now() / 1000) + 600;
  const extMatch = rawPublicId.match(/\.([a-zA-Z0-9]+)$/);
  const format = (parsed?.format || (extMatch ? extMatch[1] : "pdf")).toLowerCase();
  const publicIdWithoutExt = rawPublicId.replace(/\.[a-zA-Z0-9]+$/, "");
  const publicIdWithExt = rawPublicId.toLowerCase().endsWith(`.${format}`)
    ? rawPublicId
    : `${rawPublicId}.${format}`;

  // Candidate combinations of (resource_type, public_id, format) for both 'image' and 'raw' PDF/doc storage
  const attempts: Array<{
    resourceType: "image" | "raw";
    publicId: string;
    format: string;
  }> = [
    {
      resourceType: "image",
      publicId: publicIdWithoutExt,
      format,
    },
    {
      resourceType: "raw",
      publicId: publicIdWithExt,
      format: "",
    },
    {
      resourceType: "raw",
      publicId: rawPublicId,
      format: "",
    },
    {
      resourceType: "raw",
      publicId: publicIdWithoutExt,
      format,
    },
  ];

  // Prioritize 'raw' attempts first if URL explicitly indicates '/raw/'
  if (parsed?.resourceType === "raw") {
    attempts.reverse();
  }

  for (const attempt of attempts) {
    try {
      const signedUrl = cld.utils.private_download_url(
        attempt.publicId,
        attempt.format,
        {
          resource_type: attempt.resourceType,
          type: parsed?.deliveryType || "upload",
          expires_at: expiresAt,
        }
      );

      const res = await fetch(signedUrl, { cache: "no-store" });
      if (res.ok) {
        const arr = await res.arrayBuffer();
        if (arr.byteLength > 0) {
          return {
            buffer: Buffer.from(arr),
            contentType:
              res.headers.get("content-type") ||
              (format === "pdf" ? "application/pdf" : "application/octet-stream"),
          };
        }
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

