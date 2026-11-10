import mongoose, { Schema, Document as MongooseDocument, Model } from "mongoose";

export type DocumentFolder = "Contracts" | "Agreements" | "NDAs" | "KYC & Compliance" | "Other";
export type DocumentStatus = "pending_signature" | "signed" | "completed";
export type FileTypeCategory = "pdf" | "doc" | "image";

export interface ISignatureAudit {
  signatureDataUrl: string;
  signatureMode: "draw" | "type";
  typedText?: string;
  fontFamily?: string;
  signerName: string;
  signerEmail: string;
  signerTitle?: string;
  signedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  certificateId: string;
  pageNumber?: number;
  positionX?: number;
  positionY?: number;
  signedFileUrl?: string | null;
}

export interface ISignDocument extends MongooseDocument {
  user?: mongoose.Types.ObjectId | null;
  isGlobal: boolean;
  globalParentId?: mongoose.Types.ObjectId | null;
  uploadedBy?: mongoose.Types.ObjectId | null;
  uploadedByName: string;
  uploadedByRole: string;
  title: string;
  fileName: string;
  description: string;
  folder: DocumentFolder;
  fileType: FileTypeCategory;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  publicId: string;
  pageCount: number;
  requiresSignature: boolean;
  status: DocumentStatus;
  isStarred: boolean;
  isTemplate: boolean;
  documentContentPreview?: string;
  signature?: ISignatureAudit | null;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<ISignDocument>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
      index: true,
    },
    isGlobal: {
      type: Boolean,
      default: false,
      index: true,
    },
    globalParentId: {
      type: Schema.Types.ObjectId,
      ref: "SignDocument",
      default: null,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    uploadedByName: {
      type: String,
      default: "Compliance Team",
    },
    uploadedByRole: {
      type: String,
      default: "admin",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    folder: {
      type: String,
      enum: ["Contracts", "Agreements", "NDAs", "KYC & Compliance", "Other"],
      default: "Agreements",
    },
    fileType: {
      type: String,
      enum: ["pdf", "doc", "image"],
      default: "pdf",
    },
    mimeType: {
      type: String,
      default: "application/pdf",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      default: "",
    },
    pageCount: {
      type: Number,
      default: 3,
    },
    requiresSignature: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["pending_signature", "signed", "completed"],
      default: "pending_signature",
    },
    isStarred: {
      type: Boolean,
      default: false,
    },
    isTemplate: {
      type: Boolean,
      default: false,
    },
    documentContentPreview: {
      type: String,
      default: "",
    },
    signature: {
      signatureDataUrl: { type: String },
      signatureMode: { type: String, enum: ["draw", "type"], default: "draw" },
      typedText: { type: String },
      fontFamily: { type: String },
      signerName: { type: String },
      signerEmail: { type: String },
      signerTitle: { type: String },
      signedAt: { type: Date },
      ipAddress: { type: String },
      userAgent: { type: String },
      certificateId: { type: String },
      pageNumber: { type: Number, default: 1 },
      positionX: { type: Number, default: 65 },
      positionY: { type: Number, default: 78 },
      signedFileUrl: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

if (
  mongoose.models.SignDocument &&
  !mongoose.models.SignDocument.schema.path("isGlobal")
) {
  delete mongoose.models.SignDocument;
}

const SignDocument: Model<ISignDocument> =
  mongoose.models.SignDocument ||
  mongoose.model<ISignDocument>("SignDocument", DocumentSchema);

export default SignDocument;

