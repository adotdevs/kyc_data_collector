import mongoose from "mongoose";

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://bitblze:eByoEepRQsoHJtsu@cluster0.8br5o9v.mongodb.net/kyc_signdocs";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  seeded: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache || {
  conn: null,
  promise: null,
  seeded: false,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB() {
  if (cached.conn) {
    if (!cached.seeded) {
      cached.seeded = true;
      await ensureInitialSeed().catch((err) =>
        console.warn("Seed check warning:", err?.message)
      );
    }
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
      })
      .then((m) => m);
  }

  cached.conn = await cached.promise;

  if (!cached.seeded) {
    cached.seeded = true;
    await ensureInitialSeed().catch((err) =>
      console.warn("Seed check warning:", err?.message)
    );
  }

  return cached.conn;
}

async function ensureInitialSeed() {
  const User = (await import("@/models/User")).default;
  const SignDocument = (await import("@/models/Document")).default;
  const SystemSettings = (await import("@/models/SystemSettings")).default;

  const existingCount = await User.countDocuments();
  if (existingCount > 0) {
    return;
  }

  console.log("🌱 Initializing fresh kyc_signdocs database with default roles and sample documents...");

  // 1. Ensure default SystemSettings
  await SystemSettings.create({
    requireEmailVerification: false,
    requireKycBeforeSign: false,
    autoNotifyClientOnUpload: true,
    autoNotifyAdminOnSign: true,
    companyName: "SignDocs Compliance Portal",
    supportEmail: "support@betabase.pro",
  });

  // 2. Try to also copy any existing superadmin from legacy 'data' database on same cluster if present
  const legacyUri = process.env.LEGACY_MONGODB_URI;
  if (legacyUri) {
    try {
      const legacyConn = await mongoose
        .createConnection(legacyUri, { serverSelectionTimeoutMS: 4000 })
        .asPromise();
      const legacySuperAdmins = await legacyConn
        .collection("users")
        .find({ role: "superadmin" })
        .limit(3)
        .toArray();

      for (const sa of legacySuperAdmins) {
        if (sa.email && sa.email !== "superadmin@signdocs.com") {
          await User.create({
            firstName: sa.firstName || "Super",
            lastName: sa.lastName || "Admin",
            email: sa.email.toLowerCase(),
            phone: String(sa.phone || "+15550109999"),
            password: sa.password || "Admin@123456",
            address: sa.address || "100 Compliance Way",
            city: sa.city || "Zurich",
            country: sa.country || "Switzerland",
            postalCode: sa.postalCode || "8001",
            role: "superadmin",
            verified: true,
            kyc: true,
          });
        }
      }
      await legacyConn.close();
    } catch {
      // Ignore if legacy DB is unreachable
    }
  }

  // 3. Create Primary Superadmin, Admin, Sub-Admin, and Demo Client
  const superAdmin = await User.create({
    firstName: "Alexander",
    lastName: "Vance",
    email: "superadmin@signdocs.com",
    phone: "+41 44 580 11 00",
    password: "Password@123",
    address: "Bahnhofstrasse 42",
    city: "Zurich",
    country: "Switzerland",
    postalCode: "8001",
    role: "superadmin",
    verified: true,
    kyc: true,
  });

  const adminUser = await User.create({
    firstName: "victoria",
    lastName: "Sterling",
    email: "admin@signdocs.com",
    phone: "+44 20 7946 0921",
    password: "Password@123",
    address: "1 Canada Square, Canary Wharf",
    city: "London",
    country: "United Kingdom",
    postalCode: "E14 5AB",
    role: "admin",
    verified: true,
    kyc: true,
    adminPermissions: {
      isProfileUpdate: true,
      isSubManagement: true,
      isEditSubManagementPermissions: true,
      isAddUsersToSubAdmin: true,
      canManageKyc: true,
      canManageDocuments: true,
    },
  });

  const subAdminUser = await User.create({
    firstName: "Marcus",
    lastName: "Lindqvist",
    email: "subadmin@signdocs.com",
    phone: "+49 30 901820",
    password: "Password@123",
    address: "Friedrichstraße 114A",
    city: "Berlin",
    country: "Germany",
    postalCode: "10117",
    role: "subadmin",
    verified: true,
    kyc: true,
    permissions: {
      viewClientDetails: true,
      editUserProfile: true,
      canReviewKyc: true,
      canManageDocuments: true,
    },
  });

  const clientUser = await User.create({
    firstName: "Olivia",
    lastName: "Laurent",
    email: "client@signdocs.com",
    phone: "+33 1 42 68 55 00",
    password: "Password@123",
    address: "24 Rue du Faubourg Saint-Honoré",
    city: "Paris",
    country: "France",
    postalCode: "75008",
    role: "user",
    verified: true,
    kyc: false,
    isShared: true,
    assignedSubAdmin: subAdminUser._id,
    assignedSubAdmins: [subAdminUser._id],
    submitDoc: {
      status: "pending",
      idType: "passport",
      nationality: "France",
    },
  });

  const secondClient = await User.create({
    firstName: "Felix",
    lastName: "Werner",
    email: "felix.werner@signdocs.com",
    phone: "+49 151 8766106",
    password: "Password@123",
    address: "Ziegelweg 4",
    city: "Grimma",
    country: "Germany",
    postalCode: "04668",
    role: "user",
    verified: true,
    kyc: true,
    isShared: false,
    assignedSubAdmin: subAdminUser._id,
    assignedSubAdmins: [subAdminUser._id],
    submitDoc: {
      status: "verified",
      idType: "national_id",
      idNumber: "DE-88492014",
      dateOfBirth: "1988-05-14",
      nationality: "Germany",
      submittedAt: new Date(Date.now() - 86400000 * 3),
      verifiedAt: new Date(Date.now() - 86400000 * 2),
    },
  });

  // 4. Create rich sample documents for Olivia Laurent matching the SignDocs reference gallery
  const sampleDocs = [
    {
      user: clientUser._id,
      uploadedBy: adminUser._id,
      uploadedByName: "Victoria Sterling",
      uploadedByRole: "admin",
      title: "Service Agreement.pdf",
      fileName: "Service Agreement.pdf",
      description:
        "Master Client Onboarding & Professional Services Agreement covering compliance verification, data stewardship, and service terms.",
      folder: "Agreements" as const,
      fileType: "pdf" as const,
      mimeType: "application/pdf",
      fileSize: 2202009, // ~2.1 MB
      fileUrl: "/api/documents/sample/pdf",
      pageCount: 5,
      requiresSignature: true,
      status: "pending_signature" as const,
      documentContentPreview:
        "MASTER SERVICE AGREEMENT\n\nThis Master Service Agreement (\"Agreement\") is entered into between SignDocs Compliance Portal (\"Provider\") and Olivia Laurent (\"Client\").\n\n1. SCOPE OF SERVICES\nProvider agrees to deliver secure identity onboarding, document custody, and legally binding electronic execution services in accordance with EU eIDAS and global compliance standards.\n\n2. CLIENT OBLIGATIONS & KYC COMPLIANCE\nClient represents and warrants that all identity verification documents (Government-issued ID and Proof of Residence) provided during KYC onboarding are accurate, current, and authentic.\n\n3. TERM & TERMINATION\nThis Agreement commences on the date of electronic signature below and remains in full force until terminated by either party upon thirty (30) days written notice.\n\n4. ELECTRONIC EXECUTION\nThe parties expressly consent to execute this Agreement via electronic signature.",
      createdAt: new Date("2026-03-06T10:30:00Z"),
    },
    {
      user: clientUser._id,
      uploadedBy: adminUser._id,
      uploadedByName: "Victoria Sterling",
      uploadedByRole: "admin",
      title: "NDA.pdf",
      fileName: "NDA.pdf",
      description:
        "Mutual Non-Disclosure and Confidentiality Agreement protecting proprietary client disclosures and compliance records.",
      folder: "NDAs" as const,
      fileType: "pdf" as const,
      mimeType: "application/pdf",
      fileSize: 1468006, // ~1.4 MB
      fileUrl: "/api/documents/sample/pdf",
      pageCount: 3,
      requiresSignature: true,
      status: "pending_signature" as const,
      documentContentPreview:
        "MUTUAL NON-DISCLOSURE AGREEMENT (NDA)\n\nThis Mutual Non-Disclosure Agreement is entered into by and between SignDocs Compliance Portal and Olivia Laurent.\n\n1. DEFINITION OF CONFIDENTIAL INFORMATION\n\"Confidential Information\" includes all non-public personal, financial, regulatory, or business documents uploaded to or exchanged within the SignDocs portal.\n\n2. NON-DISCLOSURE COVENANT\nEach party agrees to hold the other party's Confidential Information in strict confidence and not to disclose such information to any unauthorized third party.\n\n3. DATA SECURITY\nAll records are encrypted in transit and at rest using enterprise-grade cryptographic controls.",
      createdAt: new Date("2026-03-05T14:15:00Z"),
    },
    {
      user: clientUser._id,
      uploadedBy: subAdminUser._id,
      uploadedByName: "Marcus Lindqvist",
      uploadedByRole: "subadmin",
      title: "Project Proposal.docx",
      fileName: "Project Proposal.docx",
      description:
        "Scope of Work & Onboarding Implementation Proposal for Q1-Q2 2026.",
      folder: "Contracts" as const,
      fileType: "doc" as const,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileSize: 3984588, // ~3.8 MB
      fileUrl: "/api/documents/sample/pdf",
      pageCount: 6,
      requiresSignature: true,
      status: "pending_signature" as const,
      documentContentPreview:
        "PROJECT IMPLEMENTATION PROPOSAL & STATEMENT OF WORK\n\nPrepared for: Olivia Laurent\nPrepared by: Marcus Lindqvist, Senior Compliance Officer\n\n1. EXECUTIVE SUMMARY\nThis proposal outlines the milestones, deliverables, and compliance checkpoints for onboarding and digital document governance.\n\n2. KEY DELIVERABLES\n• Phase 1: Full KYC Identity & Address Verification\n• Phase 2: Execution of Master Agreements & NDAs\n• Phase 3: Ongoing Compliance Archiving & Audit Certification\n\n3. AUTHORIZATION\nPlease review and sign below to authorize project commencement.",
      createdAt: new Date("2026-03-04T09:00:00Z"),
    },
    {
      user: clientUser._id,
      uploadedBy: superAdmin._id,
      uploadedByName: "Alexander Vance",
      uploadedByRole: "superadmin",
      title: "Terms of Service.pdf",
      fileName: "Terms of Service.pdf",
      description:
        "Standard Platform Terms of Service & Electronic Signature Disclosure.",
      folder: "Agreements" as const,
      fileType: "pdf" as const,
      mimeType: "application/pdf",
      fileSize: 1992294, // ~1.9 MB
      fileUrl: "/api/documents/sample/pdf",
      pageCount: 4,
      requiresSignature: true,
      status: "pending_signature" as const,
      documentContentPreview:
        "TERMS OF SERVICE & E-SIGN CONSENT DISCLOSURE\n\n1. ACCEPTANCE OF TERMS\nBy accessing the SignDocs portal and executing documents electronically, you agree to be bound by these Terms of Service.\n\n2. CONSENT TO ELECTRONIC SIGNATURES\nYou affirmatively consent to use electronic signatures and acknowledge that your electronic signature on any document uploaded by an administrator is legally binding.\n\n3. AUDIT TRAIL & TAMPER EVIDENCE\nEvery signed document includes a unique cryptographic Certificate ID, signer timestamp, and audit record.",
      createdAt: new Date("2026-03-03T16:40:00Z"),
    },
    {
      user: clientUser._id,
      uploadedBy: adminUser._id,
      uploadedByName: "Victoria Sterling",
      uploadedByRole: "admin",
      title: "Partnership Agreement.pdf",
      fileName: "Partnership Agreement.pdf",
      description:
        "Strategic Commercial Partnership & Compliance Framework Agreement.",
      folder: "Contracts" as const,
      fileType: "pdf" as const,
      mimeType: "application/pdf",
      fileSize: 2621440, // ~2.5 MB
      fileUrl: "/api/documents/sample/pdf",
      pageCount: 5,
      requiresSignature: true,
      status: "signed" as const,
      signature: {
        signatureDataUrl: "",
        signatureMode: "type" as const,
        typedText: "Olivia Laurent",
        fontFamily: "Dancing Script",
        signerName: "Olivia Laurent",
        signerEmail: "client@signdocs.com",
        signerTitle: "Managing Director",
        signedAt: new Date("2026-03-02T17:20:00Z"),
        ipAddress: "127.0.0.1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        certificateId: "SD-CERT-2026-88419A",
        pageNumber: 5,
      },
      documentContentPreview:
        "STRATEGIC PARTNERSHIP AGREEMENT\n\nThis Partnership Agreement establishes the collaborative terms between SignDocs Compliance Portal and Olivia Laurent.\n\n1. COOPERATIVE GOVERNANCE\nBoth parties agree to maintain verified KYC compliance status and uphold transparent governance standards throughout the partnership term.\n\n2. TERM\nEffective March 2, 2026 for an initial period of twenty-four (24) months.",
      createdAt: new Date("2026-03-02T11:20:00Z"),
    },
    {
      user: clientUser._id,
      uploadedBy: adminUser._id,
      uploadedByName: "Victoria Sterling",
      uploadedByRole: "admin",
      title: "Employment Contract.docx",
      fileName: "Employment Contract.docx",
      description: "Executive Advisory & Retainer Engagement Contract.",
      folder: "Contracts" as const,
      fileType: "doc" as const,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      fileSize: 4194304, // ~4.0 MB
      fileUrl: "/api/documents/sample/pdf",
      pageCount: 7,
      requiresSignature: true,
      status: "pending_signature" as const,
      documentContentPreview:
        "EXECUTIVE ENGAGEMENT & ADVISORY CONTRACT\n\n1. APPOINTMENT\nThe Organization hereby engages the Client in an advisory capacity subject to the terms and compliance conditions set forth herein.\n\n2. COMPLIANCE & CODE OF CONDUCT\nEngagement is contingent upon maintaining verified KYC documentation and executing all required confidentiality covenants.",
      createdAt: new Date("2026-02-28T13:10:00Z"),
    },
    {
      user: secondClient._id,
      uploadedBy: subAdminUser._id,
      uploadedByName: "Marcus Lindqvist",
      uploadedByRole: "subadmin",
      title: "KYC Compliance Declaration.pdf",
      fileName: "KYC Compliance Declaration.pdf",
      description: "Annual Customer Due Diligence & Beneficial Ownership Declaration.",
      folder: "KYC & Compliance" as const,
      fileType: "pdf" as const,
      mimeType: "application/pdf",
      fileSize: 1258291,
      fileUrl: "/api/documents/sample/pdf",
      pageCount: 2,
      requiresSignature: true,
      status: "pending_signature" as const,
      documentContentPreview:
        "CUSTOMER DUE DILIGENCE (CDD) & KYC DECLARATION\n\nClient Name: Felix Werner\nAddress: Ziegelweg 4, 04668 Grimma, Germany\n\nI hereby declare that the identification and residential address records submitted for KYC verification are accurate and belong solely to me.",
      createdAt: new Date("2026-03-07T08:30:00Z"),
    },
  ];

  await SignDocument.insertMany(sampleDocs);
  console.log("✅ Initial seed completed for kyc_signdocs.");
}

