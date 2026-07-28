import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import {
  visitorPassLineItemSchema,
  employeeLineItemSchema,
  findMissingVisitorPassLineItemField,
  findMissingEmployeeLineItemField,
  VISITOR_PASS_LINE_ITEM_LABELS,
  EMPLOYEE_LINE_ITEM_LABELS,
} from "@/lib/validation/transactionLineItem";
import {
  saveLineItemFile,
  deleteLineItemFile,
  isAllowedFileType,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/lineItemFileStorage";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { lineItemId } = await params;
  const existing = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    include: { transaction: { include: { matrixType: { select: { name: true } } } } },
  });

  if (!existing) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const isVisitorPass = existing.transaction.matrixType.name === "Visitor Pass";

  if (isVisitorPass) {
    const raw = {
      visitorName: formData.get("visitorName")?.toString() ?? "",
      jobTitle: formData.get("jobTitle")?.toString() ?? "",
      company: formData.get("company")?.toString() ?? "",
      contactNumber: formData.get("contactNumber")?.toString() || undefined,
      emailAddress: formData.get("emailAddress")?.toString() || undefined,
      transportType: formData.get("transportType")?.toString() || undefined,
    };

    const parsed = visitorPassLineItemSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const missingField = findMissingVisitorPassLineItemField(raw);
    if (missingField) {
      return NextResponse.json(
        { error: `${VISITOR_PASS_LINE_ITEM_LABELS[missingField]} is required` },
        { status: 400 }
      );
    }

    let uploadFileUrl = existing.uploadFileUrl;
    let uploadFileName = existing.uploadFileName;
    const file = formData.get("uploadFile");
    if (file instanceof File && file.size > 0) {
      if (!isAllowedFileType(file.type)) {
        return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "File is too large" }, { status: 400 });
      }
      const saved = await saveLineItemFile(file);
      const oldUrl = existing.uploadFileUrl;
      uploadFileUrl = saved.url;
      uploadFileName = saved.fileName;
      if (oldUrl) await deleteLineItemFile(oldUrl);
    }

    const updated = await prisma.transactionLineItem.update({
      where: { id: lineItemId },
      data: {
        visitorName: parsed.data.visitorName,
        jobTitle: parsed.data.jobTitle,
        company: parsed.data.company,
        contactNumber: parsed.data.contactNumber,
        emailAddress: parsed.data.emailAddress,
        transportType: parsed.data.transportType,
        uploadFileUrl,
        uploadFileName,
      },
    });
    return NextResponse.json(updated, { status: 200 });
  }

  const raw = {
    employeeType: formData.get("employeeType")?.toString() || undefined,
    employeeId: formData.get("employeeId")?.toString() || undefined,
    name: formData.get("name")?.toString() || undefined,
    remarks: formData.get("remarks")?.toString() ?? "",
  };

  const parsed = employeeLineItemSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const missingField = findMissingEmployeeLineItemField(raw);
  if (missingField) {
    return NextResponse.json(
      { error: `${EMPLOYEE_LINE_ITEM_LABELS[missingField]} is required` },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.transactionLineItem.update({
      where: { id: lineItemId },
      data: {
        employeeType: parsed.data.employeeType,
        employeeId:
          parsed.data.employeeType === "Mega Employee" ? parsed.data.employeeId : null,
        name: parsed.data.employeeType !== "Mega Employee" ? parsed.data.name : null,
        remarks: parsed.data.remarks,
      },
    });
    return NextResponse.json(updated, { status: 200 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json({ error: "Invalid employee selected" }, { status: 400 });
    }
    throw err;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; lineItemId: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { lineItemId } = await params;
  const existing = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    select: { uploadFileUrl: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Line item not found" }, { status: 404 });
  }

  await prisma.transactionLineItem.delete({ where: { id: lineItemId } });
  if (existing.uploadFileUrl) await deleteLineItemFile(existing.uploadFileUrl);

  return new NextResponse(null, { status: 204 });
}
