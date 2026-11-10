import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import SignDocument from "@/models/Document";
import User from "@/models/User";
import { getCurrentUser, isStaffRole, canStaffAccessUser } from "@/lib/auth";
import { deleteFromCloudinary } from "@/lib/cloudinary";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const viewer = await getCurrentUser(req);
    if (!viewer) {
      return NextResponse.json(
        { success: false, msg: "Authentication required" },
        { status: 401 }
      );
    }

    const doc = await SignDocument.findById(params.id).populate(
      "user",
      "firstName lastName email kyc verified"
    );

    if (!doc) {
      return NextResponse.json(
        { success: false, msg: "Document not found" },
        { status: 404 }
      );
    }

    const ownerId = doc.user ? String((doc.user as any)?._id || doc.user) : "";
    if (
      !doc.isGlobal &&
      !isStaffRole(viewer.role) &&
      ownerId !== String(viewer._id)
    ) {
      return NextResponse.json(
        { success: false, msg: "Access denied" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      document: doc,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to fetch document" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const viewer = await getCurrentUser(req);
    if (!viewer || !isStaffRole(viewer.role)) {
      return NextResponse.json(
        { success: false, msg: "Only authorized administrators can modify documents" },
        { status: 403 }
      );
    }

    if (
      (viewer.role === "admin" &&
        viewer.adminPermissions?.canManageDocuments === false) ||
      (viewer.role === "subadmin" &&
        viewer.permissions?.canManageDocuments === false)
    ) {
      return NextResponse.json(
        {
          success: false,
          msg: "Your account does not have permission to modify documents",
        },
        { status: 403 }
      );
    }

    const doc = await SignDocument.findById(params.id);
    if (!doc) {
      return NextResponse.json(
        { success: false, msg: "Document not found" },
        { status: 404 }
      );
    }

    if (doc.isGlobal) {
      if (!isStaffRole(viewer.role)) {
        return NextResponse.json(
          { success: false, msg: "Access denied" },
          { status: 403 }
        );
      }
    } else if (doc.user) {
      const ownerUser = await User.findById(doc.user);
      if (ownerUser && !canStaffAccessUser(viewer, ownerUser)) {
        return NextResponse.json(
          { success: false, msg: "Access denied" },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    if (body.title !== undefined) doc.title = body.title.trim();
    if (body.description !== undefined) doc.description = body.description.trim();
    if (body.folder !== undefined) doc.folder = body.folder;
    if (body.isStarred !== undefined) doc.isStarred = Boolean(body.isStarred);
    if (body.documentContentPreview !== undefined) {
      doc.documentContentPreview = body.documentContentPreview;
    }

    await doc.save();

    return NextResponse.json({
      success: true,
      msg: "Document updated",
      document: doc,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to update document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    const viewer = await getCurrentUser(req);
    if (!viewer || !isStaffRole(viewer.role)) {
      return NextResponse.json(
        { success: false, msg: "Only authorized administrators can modify documents" },
        { status: 403 }
      );
    }

    if (
      (viewer.role === "admin" &&
        (viewer.adminPermissions?.canManageDocuments === false ||
          viewer.adminPermissions?.canDeleteDocuments === false)) ||
      (viewer.role === "subadmin" &&
        (viewer.permissions?.canManageDocuments === false ||
          viewer.permissions?.canDeleteDocuments !== true))
    ) {
      return NextResponse.json(
        {
          success: false,
          msg: "Your account does not have permission to delete documents",
        },
        { status: 403 }
      );
    }

    const doc = await SignDocument.findById(params.id);
    if (!doc) {
      return NextResponse.json(
        { success: false, msg: "Document not found" },
        { status: 404 }
      );
    }

    if (doc.isGlobal) {
      if (!isStaffRole(viewer.role)) {
        return NextResponse.json(
          { success: false, msg: "Only administrators can delete global documents" },
          { status: 403 }
        );
      }
    } else if (doc.user) {
      const isOwner = String(doc.user) === String(viewer._id);
      if (!isOwner) {
        const ownerUser = await User.findById(doc.user);
        if (ownerUser && !canStaffAccessUser(viewer, ownerUser)) {
          return NextResponse.json(
            { success: false, msg: "Access denied" },
            { status: 403 }
          );
        }
      }
    }

    // Delete original file and signed file from Cloudinary
    if (doc.publicId || (doc.fileUrl && doc.fileUrl.includes("cloudinary.com"))) {
      await deleteFromCloudinary(
        doc.publicId || doc.fileUrl,
        doc.fileType === "doc" ? "raw" : "image"
      );
    }
    if (doc.signature?.signedFileUrl) {
      await deleteFromCloudinary(doc.signature.signedFileUrl, "image");
    }

    // If deleting a global master document, also clean up child copies
    if (doc.isGlobal) {
      const childCopies = await SignDocument.find({ globalParentId: doc._id });
      for (const copy of childCopies) {
        if (copy.signature?.signedFileUrl) {
          await deleteFromCloudinary(copy.signature.signedFileUrl, "image");
        }
      }
      await SignDocument.deleteMany({ globalParentId: doc._id });
    }

    await SignDocument.findByIdAndDelete(doc._id);

    return NextResponse.json({
      success: true,
      msg: "Document deleted successfully",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, msg: error?.message || "Failed to delete document" },
      { status: 500 }
    );
  }
}

