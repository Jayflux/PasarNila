import { z } from "zod";

import { formText, formUuid, runSideEffect, type Gate } from "@/lib/actions/core/shared";
import { MESSAGES, type ActionResult } from "@/lib/write/action-result";
import { classifyWriteError, type DbResponse } from "@/lib/write/outcome";

export type ProductPhotoSaved = {
  productId: string;
  imagePath: string | null;
  imageAlt: string | null;
  updatedAt: string;
};

export type ProductPhotoResult = ActionResult<ProductPhotoSaved, "photo"> & {
  operation: "update" | "delete";
};

export interface ProductPhotoDb {
  updatePhoto(input: {
    productId: string;
    imagePath: string | null;
    imageAlt: string | null;
  }): Promise<DbResponse>;
  read(productId: string): Promise<DbResponse>;
}

const photoRowSchema = z.object({
  id: z.string().uuid(),
  image_path: z.string().nullable(),
  image_alt: z.string().nullable(),
  updated_at: z.string(),
});

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PHOTO_BYTES = 1 * 1024 * 1024; // 1 MB

export async function updateProductPhoto(
  form: FormData,
  deps: {
    gate: Gate<ProductPhotoDb>;
    onSuccess?: (product: ProductPhotoSaved) => Promise<void> | void;
  },
): Promise<ProductPhotoResult> {
  const gate = await deps.gate();
  if (!gate.ok) {
    return {
      ...gate.result,
      operation: "update",
    };
  }

  const productId = formUuid(form, "productId");
  if (!productId) {
    return {
      state: "invalid",
      message: "ID produk tidak valid.",
      fieldErrors: { photo: "ID produk tidak valid." },
      operation: "update",
    };
  }

  const alt = formText(form, "imageAlt");

  const file = form.get("photo");
  let dataUrl: string | null = null;

  if (file instanceof File && file.size > 0) {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return {
        state: "invalid",
        message: "Format foto harus JPG, PNG, atau WebP.",
        fieldErrors: { photo: "Format foto harus JPG, PNG, atau WebP." },
        operation: "update",
      };
    }
    if (file.size > MAX_PHOTO_BYTES) {
      return {
        state: "invalid",
        message: "Ukuran foto maksimal 1 MB.",
        fieldErrors: { photo: "Ukuran foto maksimal 1 MB." },
        operation: "update",
      };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    dataUrl = `data:${file.type};base64,${buffer.toString("base64")}`;
  } else {
    const rawDataUrl = form.get("dataUrl");
    if (typeof rawDataUrl === "string" && rawDataUrl.startsWith("data:image/")) {
      dataUrl = rawDataUrl;
    } else {
      return {
        state: "invalid",
        message: "Pilih file foto untuk diunggah.",
        fieldErrors: { photo: "Pilih file foto untuk diunggah." },
        operation: "update",
      };
    }
  }

  try {
    const response = await gate.db.updatePhoto({
      productId,
      imagePath: dataUrl,
      imageAlt: alt || null,
    });

    if (response.error) {
      const failure = classifyWriteError(response.error);
      if (failure.kind !== "uncertain") {
        return {
          state: failure.kind === "forbidden" ? "forbidden" : "rejected",
          message: failure.kind === "invalid" ? "Ukuran atau format foto tidak valid." : MESSAGES.rejected,
          operation: "update",
        };
      }
      return {
        state: "uncertain",
        message: MESSAGES.uncertain,
        operation: "update",
      };
    }

    const parsed = photoRowSchema.safeParse(response.data);
    if (!parsed.success) {
      return {
        state: "uncertain",
        message: MESSAGES.uncertain,
        operation: "update",
      };
    }

    const saved: ProductPhotoSaved = {
      productId: parsed.data.id,
      imagePath: parsed.data.image_path,
      imageAlt: parsed.data.image_alt,
      updatedAt: parsed.data.updated_at,
    };

    if (deps.onSuccess) {
      runSideEffect(() => deps.onSuccess!(saved));
    }

    return {
      state: "saved",
      message: "Foto produk berhasil diperbarui.",
      saved,
      operation: "update",
    };
  } catch {
    return {
      state: "uncertain",
      message: MESSAGES.uncertain,
      operation: "update",
    };
  }
}

export async function deleteProductPhoto(
  form: FormData,
  deps: {
    gate: Gate<ProductPhotoDb>;
    onSuccess?: (productId: string) => Promise<void> | void;
  },
): Promise<ProductPhotoResult> {
  const gate = await deps.gate();
  if (!gate.ok) {
    return {
      ...gate.result,
      operation: "delete",
    };
  }

  const productId = formUuid(form, "productId");
  if (!productId) {
    return {
      state: "invalid",
      message: "ID produk tidak valid.",
      fieldErrors: { photo: "ID produk tidak valid." },
      operation: "delete",
    };
  }

  try {
    const response = await gate.db.updatePhoto({
      productId,
      imagePath: null,
      imageAlt: null,
    });

    if (response.error) {
      const failure = classifyWriteError(response.error);
      if (failure.kind !== "uncertain") {
        return {
          state: failure.kind === "forbidden" ? "forbidden" : "rejected",
          message: MESSAGES.rejected,
          operation: "delete",
        };
      }
      return {
        state: "uncertain",
        message: MESSAGES.uncertain,
        operation: "delete",
      };
    }

    const parsed = photoRowSchema.safeParse(response.data);
    if (!parsed.success) {
      return {
        state: "uncertain",
        message: MESSAGES.uncertain,
        operation: "delete",
      };
    }

    if (deps.onSuccess) {
      runSideEffect(() => deps.onSuccess!(parsed.data.id));
    }

    return {
      state: "saved",
      message: "Foto produk berhasil dihapus dan kembali ke tampilan awal.",
      saved: {
        productId: parsed.data.id,
        imagePath: null,
        imageAlt: null,
        updatedAt: parsed.data.updated_at,
      },
      operation: "delete",
    };
  } catch {
    return {
      state: "uncertain",
      message: MESSAGES.uncertain,
      operation: "delete",
    };
  }
}
