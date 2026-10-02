import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Only Admins and Teachers may upload
        const session = await auth();
        if (
          !session?.user ||
          !["ADMIN", "TEACHER"].includes(session.user.role)
        ) {
          throw new Error("You are not allowed to upload files.");
        }

        return {
          allowedContentTypes: [
            "video/*",
            "audio/*",
            "image/*",
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/vnd.ms-powerpoint",
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/plain",
            "application/zip",
          ],
          maximumSizeInBytes: 1024 * 1024 * 1024, // 1 GB per file
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {
        // Nothing to do here: the link is saved when you tap Save on the form
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
