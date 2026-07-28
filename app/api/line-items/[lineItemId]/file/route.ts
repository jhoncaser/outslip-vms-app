import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { lineItemFilePath } from "@/lib/lineItemFileStorage";

function contentTypeFor(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lineItemId: string }> }
) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { lineItemId } = await params;
  const lineItem = await prisma.transactionLineItem.findUnique({
    where: { id: lineItemId },
    select: { uploadFileUrl: true, uploadFileName: true },
  });

  if (!lineItem?.uploadFileUrl) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const buffer = await readFile(lineItemFilePath(lineItem.uploadFileUrl));
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentTypeFor(lineItem.uploadFileName ?? lineItem.uploadFileUrl),
        "Content-Disposition": `inline; filename="${lineItem.uploadFileName ?? "file"}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
