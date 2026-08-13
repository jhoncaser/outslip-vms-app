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
  isAllowedFileType,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/lineItemFileStorage";
import { emitTransactionChanged } from "@/lib/transactionEvents";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: transactionId } = await params;
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      postedAt: true,
      status: { select: { name: true } },
      matrixType: { select: { name: true } },
    },
  });

  if (!transaction) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  if (transaction.postedAt !== null) {
    return NextResponse.json(
      { error: "Cannot modify line items on a posted transaction." },
      { status: 409 }
    );
  }

  if (transaction.status.name === "Cancelled") {
    return NextResponse.json(
      { error: "Cannot modify line items on a cancelled transaction." },
      { status: 409 }
    );
  }

  const formData = await request.formData();
  const isVisitorPass = transaction.matrixType.name === "Visitor Pass";

  if (isVisitorPass) {
    const raw = {
      visitorName: formData.get("visitorName")?.toString() ?? "",
      jobTitle: formData.get("jobTitle")?.toString() ?? "",
      company: formData.get("company")?.toString() ?? "",
      contactNumber: formData.get("contactNumber")?.toString() || undefined,
      emailAddress: formData.get("emailAddress")?.toString() || undefined,
      transportType: formData.get("transportType")?.toString() || undefined,
      plateNo: formData.get("plateNo")?.toString() || undefined,
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

    let uploadFileUrl: string | undefined;
    let uploadFileName: string | undefined;
    const file = formData.get("uploadFile");
    if (file instanceof File && file.size > 0) {
      if (!isAllowedFileType(file.type)) {
        return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json({ error: "File is too large" }, { status: 400 });
      }
      const saved = await saveLineItemFile(file);
      uploadFileUrl = saved.url;
      uploadFileName = saved.fileName;
    }

    const created = await prisma.transactionLineItem.create({
      data: {
        transactionId,
        visitorName: parsed.data.visitorName,
        jobTitle: parsed.data.jobTitle,
        company: parsed.data.company,
        contactNumber: parsed.data.contactNumber,
        emailAddress: parsed.data.emailAddress,
        transportType: parsed.data.transportType,
        plateNo: parsed.data.plateNo,
        uploadFileUrl,
        uploadFileName,
      },
    });
    emitTransactionChanged();
    return NextResponse.json(created, { status: 201 });
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
    const created = await prisma.transactionLineItem.create({
      data: {
        transactionId,
        employeeType: parsed.data.employeeType,
        employeeId:
          parsed.data.employeeType === "Mega Employee" ? parsed.data.employeeId : undefined,
        name: parsed.data.employeeType !== "Mega Employee" ? parsed.data.name : undefined,
        remarks: parsed.data.remarks,
      },
    });
    emitTransactionChanged();
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return NextResponse.json({ error: "Invalid employee selected" }, { status: 400 });
    }
    throw err;
  }
}
