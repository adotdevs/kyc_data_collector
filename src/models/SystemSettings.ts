import mongoose, { Schema, Document as MongooseDocument, Model } from "mongoose";

export interface IGlobalSmtpConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
  adminAlertEmail?: string;
}

export interface ISystemSettings extends MongooseDocument {
  requireEmailVerification: boolean;
  requireKycBeforeSign: boolean;
  autoNotifyClientOnUpload: boolean;
  autoNotifyAdminOnSign: boolean;
  companyName: string;
  supportEmail: string;
  smtpConfig: IGlobalSmtpConfig;
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
      default: "GOin SAS",
    },
    supportEmail: {
      type: String,
      default: "info@goin-in-vest.com",
    },
    smtpConfig: {
      enabled: {
        type: Boolean,
        default: true,
      },
      host: {
        type: String,
        default: () => process.env.EMAILHOST || "smtp.hostinger.com",
      },
      port: {
        type: Number,
        default: () => Number(process.env.EMAIL_PORT || 465),
      },
      secure: {
        type: Boolean,
        default: true,
      },
      user: {
        type: String,
        default: () => process.env.EMAILUSER || "support@betabase.pro",
      },
      pass: {
        type: String,
        default: () => process.env.EMAILPASS || "",
      },
      fromEmail: {
        type: String,
        default: () =>
          process.env.HOST_EMAIL ||
          process.env.EMAILUSER ||
          "support@betabase.pro",
      },
      fromName: {
        type: String,
        default: () => process.env.WebName || "GOin SAS",
      },
      adminAlertEmail: {
        type: String,
        default: () => process.env.ADMIN_ALERT_EMAIL || "info@goin-in-vest.com",
      },
    },
  },
  { timestamps: true }
);

const SystemSettings: Model<ISystemSettings> =
  mongoose.models.SystemSettings ||
  mongoose.model<ISystemSettings>("SystemSettings", SystemSettingsSchema);

export default SystemSettings;
