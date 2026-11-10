import mongoose, { Schema, Document as MongooseDocument, Model } from "mongoose";

export interface INotification extends MongooseDocument {
  userId?: mongoose.Types.ObjectId | null;
  recipientRole: "admin" | "user" | "all";
  type:
    | "kyc_submitted"
    | "kyc_approved"
    | "kyc_rejected"
    | "document_uploaded"
    | "document_signed"
    | "account_verified";
  title: string;
  content: string;
  link?: string;
  userEmail?: string;
  userName?: string;
  isRead: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  recipientRole: {
    type: String,
    enum: ["admin", "user", "all"],
    default: "admin",
  },
  type: {
    type: String,
    enum: [
      "kyc_submitted",
      "kyc_approved",
      "kyc_rejected",
      "document_uploaded",
      "document_signed",
      "account_verified",
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  link: {
    type: String,
    default: "",
  },
  userEmail: {
    type: String,
    default: "",
  },
  userName: {
    type: String,
    default: "",
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Notification: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);

export default Notification;

