import mongoose, { Schema, Document as MongooseDocument, Model } from "mongoose";

export interface IVerificationToken extends MongooseDocument {
  userId: mongoose.Types.ObjectId;
  token: string;
  createdAt: Date;
}

const VerificationTokenSchema = new Schema<IVerificationToken>({
  userId: {
    type: Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  token: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // 24 hours
  },
});

const VerificationToken: Model<IVerificationToken> =
  mongoose.models.VerificationToken ||
  mongoose.model<IVerificationToken>("VerificationToken", VerificationTokenSchema);

export default VerificationToken;
