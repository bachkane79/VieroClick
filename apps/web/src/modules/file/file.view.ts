export interface TaskAttachmentView {
  attachmentId: string;
  taskId: string;
  attachedAt: string;
  fileId: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
}

export function toTaskAttachmentView(attachment: {
  attachmentId: string;
  taskId: string;
  attachedAt: Date;
  file: {
    id: string;
    fileName: string;
    mimeType: string | null;
    sizeBytes: number | null;
  };
}): TaskAttachmentView {
  return {
    attachmentId: attachment.attachmentId,
    taskId: attachment.taskId,
    attachedAt: attachment.attachedAt.toISOString(),
    fileId: attachment.file.id,
    fileName: attachment.file.fileName,
    mimeType: attachment.file.mimeType,
    sizeBytes: attachment.file.sizeBytes,
  };
}
