import { NextResponse } from "next/server";
import { readAttachedFile } from "@/modules/file/file.service";
import { AppError, ValidationError } from "@/server/lib/errors";

interface Props {
  params: Promise<{ fileId: string }>;
}

function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^a-zA-Z0-9._-]+/g, "-") || "download";
  const encoded = encodeURIComponent(fileName);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: Request, { params }: Props) {
  try {
    const { fileId } = await params;
    const projectId = new URL(request.url).searchParams.get("projectId");
    if (!projectId) throw new ValidationError("projectId is required");

    const { file, bytes } = await readAttachedFile(fileId, projectId);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": file.mimeType ?? "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": contentDisposition(file.fileName),
      },
    });
  } catch (err) {
    if (err instanceof AppError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof Error) {
      return NextResponse.json({ error: err.message, code: "error" }, { status: 500 });
    }
    return NextResponse.json({ error: "Unknown error", code: "error" }, { status: 500 });
  }
}
