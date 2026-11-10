import mongoose, { Schema, Document as MongooseDocument, Model } from "mongoose";

export interface ISubAdminPermissions {
  viewClientDetails: boolean;
  editUserProfile: boolean;
  canReviewKyc: boolean;
  canManageDocuments: boolean;
}

export interface IAdminPermissions {
  isProfileUpdate: boolean;
  isSubManagement: boolean;
  isEditSubManagementPermissions: boolean;
  isAddUsersToSubAdmin: boolean;
  canManageKyc: boolean;
  canManageDocuments: boolean;
}

export interface ISmtpConfig {
  enabled: boolean;
  host?: string | null;
  port?: number | null;
  user?: string | null;
  pass?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
}

export interface ISubmitDoc {
  status: "pending" | "completed" | "verified" | "rejected";
  cnic?: string | null;
  cnicName?: string | null;
  cnicMimeType?: string | null;
  bill?: string | null;
  billName?: string | null;
  billMimeType?: string | null;
  idType?: "passport" | "national_id" | "driving_license";
  idNumber?: string;
  dateOfBirth?: string;
  nationality?: string;
  submittedAt?: Date | null;
  verifiedAt?: Date | null;
  rejectionReason?: string | null;
}

export interface IUser extends MongooseDocument {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  address: string;
  city: string;
  country: string;
  postalCode: string;
  note: string;
  role: "superadmin" | "admin" | "subadmin" | "user";
  verified: boolean;
  kyc: boolean;
  submitDoc: ISubmitDoc;
  isShared: boolean;
  assignedSubAdmin?: mongoose.Types.ObjectId | null;
  assignedSubAdmins: mongoose.Types.ObjectId[];
  isComplianceRestricted: boolean;
  complianceRestrictedAt?: Date | null;
  complianceRestrictedBy?: mongoose.Types.ObjectId | null;
  permissions: ISubAdminPermissions;
  adminPermissions: IAdminPermissions;
  smtpConfig: ISmtpConfig;
  savedSignature?: string | null;
  online: boolean;
  lastOnline?: Date | null;
  lastActivity?: Date | null;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  firstName: {
    type: String,
    required: [true, "Please enter your first name"],
    trim: true,
    maxLength: [50, "First name cannot exceed 50 characters"],
  },
  lastName: {
    type: String,
    required: [true, "Please enter your last name"],
    trim: true,
    maxLength: [50, "Last name cannot exceed 50 characters"],
  },
  email: {
    type: String,
    required: [true, "Please enter your email"],
    lowercase: true,
    unique: true,
    trim: true,
  },
  phone: {
    type: String,
    required: [true, "Please enter your phone number"],
    trim: true,
  },
  password: {
    type: String,
    required: [true, "Please enter your password"],
    minLength: [6, "Password must be at least 6 characters"],
  },
  address: {
    type: String,
    default: "",
    trim: true,
  },
  city: {
    type: String,
    default: "",
    trim: true,
  },
  country: {
    type: String,
    default: "",
    trim: true,
  },
  postalCode: {
    type: String,
    default: "",
    trim: true,
  },
  note: {
    type: String,
    default: "",
    trim: true,
  },
  role: {
    type: String,
    enum: ["superadmin", "admin", "subadmin", "user"],
    default: "user",
  },
  verified: {
    type: Boolean,
    default: false,
  },
  kyc: {
    type: Boolean,
    default: false,
  },
  submitDoc: {
    status: {
      type: String,
      enum: ["pending", "completed", "verified", "rejected"],
      default: "pending",
    },
    cnic: { type: String, default: null },
    cnicName: { type: String, default: null },
    cnicMimeType: { type: String, default: null },
    bill: { type: String, default: null },
    billName: { type: String, default: null },
    billMimeType: { type: String, default: null },
    idType: {
      type: String,
      enum: ["passport", "national_id", "driving_license"],
      default: "national_id",
    },
    idNumber: { type: String, default: "" },
    dateOfBirth: { type: String, default: "" },
    nationality: { type: String, default: "" },
    submittedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  isShared: {
    type: Boolean,
    default: false,
  },
  assignedSubAdmin: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  assignedSubAdmins: [
    {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  ],
  isComplianceRestricted: {
    type: Boolean,
    default: false,
  },
  complianceRestrictedAt: {
    type: Date,
    default: null,
  },
  complianceRestrictedBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  permissions: {
    viewClientDetails: { type: Boolean, default: true },
    editUserProfile: { type: Boolean, default: false },
    canReviewKyc: { type: Boolean, default: true },
    canManageDocuments: { type: Boolean, default: true },
  },
  adminPermissions: {
    isProfileUpdate: { type: Boolean, default: true },
    isSubManagement: { type: Boolean, default: true },
    isEditSubManagementPermissions: { type: Boolean, default: true },
    isAddUsersToSubAdmin: { type: Boolean, default: true },
    canManageKyc: { type: Boolean, default: true },
    canManageDocuments: { type: Boolean, default: true },
  },
  smtpConfig: {
    enabled: { type: Boolean, default: false },
    host: { type: String, default: null },
    port: { type: Number, default: null },
    user: { type: String, default: null },
    pass: { type: String, default: null },
    fromEmail: { type: String, default: null },
    fromName: { type: String, default: null },
  },
  savedSignature: {
    type: String,
    default: null,
  },
  online: {
    type: Boolean,
    default: false,
  },
  lastOnline: {
    type: Date,
    default: null,
  },
  lastActivity: {
    type: Date,
    default: null,
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);

export default User;
