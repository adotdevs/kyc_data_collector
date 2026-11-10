import mongoose, { Schema, Document as MongooseDocument, Model } from "mongoose";

export interface ISystemSettings extends MongooseDocument {
  requireEmailVerification: boolean;
  requireKycBeforeSign: boolean;
  autoNotifyClientOnUpload: boolean;
  autoNotifyAdminOnSign: boolean;
  companyName: string;
  supportEmail: string;
  updatedAt: Date;
}

const SystemSettingsSchema = new Schema<ISystemSettings>(
  {
    requireEmailVerification: {
      type: Boolean,
      default: false,
    },
    requireKycBeforeSign: {
      type: Boolean,
      default: false,
    },
    autoNotifyClientOnUpload: {
      type: Boolean,
      default: true,
    },
    autoNotifyAdminOnSign: {
      type: Boolean,
      default: true,
    },
    companyName: {
      type: String,
      default: "SignDocs Compliance Portal",
    },
    supportEmail: {
      type: String,
      default: "support@betabase.pro",
    },
  },
  { timestamps: true }
);

const SystemSettings: Model<ISystemSettings> =
  mongoose.models.SystemSettings ||
  mongoose.model<ISystemSettings>("SystemSettings", SystemSettingsSchema);

export default SystemSettings;
