import { describe, expect, it, vi } from "vitest";

import {
  deleteProductPhoto,
  updateProductPhoto,
  type ProductPhotoDb,
} from "@/lib/actions/core/product-photo";
import { MESSAGES } from "@/lib/write/action-result";
import { failingGate, form, ok, partnerGate } from "./support/action-fakes";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";
const T1 = "2026-11-19T01:05:00.25+00:00";

const row = (overrides: Partial<{ id: string; image_path: string | null; image_alt: string | null; updated_at: string }> = {}) => ({
  id: PRODUCT_ID,
  image_path: "data:image/jpeg;base64,samplebase64",
  image_alt: "Foto Ikan Nila",
  updated_at: T1,
  ...overrides,
});

function fakeDb(overrides: Partial<Record<keyof ProductPhotoDb, () => Promise<unknown>>> = {}) {
  return {
    updatePhoto: vi.fn(overrides.updatePhoto ?? (async () => ok(row()))),
    read: vi.fn(overrides.read ?? (async () => ok(row()))),
  } as unknown as ProductPhotoDb & Record<keyof ProductPhotoDb, ReturnType<typeof vi.fn>>;
}

describe("Server Action: Update Foto Produk", () => {
  it("berhasil memperbarui foto produk dengan data URL", async () => {
    const db = fakeDb();
    const onSuccess = vi.fn();
    const f = form({
      productId: PRODUCT_ID,
      dataUrl: "data:image/jpeg;base64,samplebase64",
      imageAlt: "Foto Ikan Nila Segar",
    });

    const result = await updateProductPhoto(f, {
      gate: partnerGate(db),
      onSuccess,
    });

    expect(result.state).toBe("saved");
    expect(result.message).toContain("Foto produk berhasil diperbarui");
    expect(db.updatePhoto).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      imagePath: "data:image/jpeg;base64,samplebase64",
      imageAlt: "Foto Ikan Nila Segar",
    });
    expect(onSuccess).toHaveBeenCalled();
  });

  it("berhasil memperbarui foto dengan objek File", async () => {
    const db = fakeDb();
    const f = new FormData();
    f.append("productId", PRODUCT_ID);
    const file = new File([new Uint8Array([1, 2, 3])], "ikan.jpg", { type: "image/jpeg" });
    f.append("photo", file);

    const result = await updateProductPhoto(f, {
      gate: partnerGate(db),
    });

    expect(result.state).toBe("saved");
    expect(db.updatePhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: PRODUCT_ID,
        imagePath: expect.stringMatching(/^data:image\/jpeg;base64,/),
      }),
    );
  });

  it("menolak format file yang tidak didukung", async () => {
    const db = fakeDb();
    const f = new FormData();
    f.append("productId", PRODUCT_ID);
    const file = new File([new Uint8Array([1, 2, 3])], "dokumen.pdf", { type: "application/pdf" });
    f.append("photo", file);

    const result = await updateProductPhoto(f, {
      gate: partnerGate(db),
    });

    expect(result.state).toBe("invalid");
    expect(result.message).toContain("JPG, PNG, atau WebP");
    expect(db.updatePhoto).not.toHaveBeenCalled();
  });

  it("menolak ukuran file foto lebih dari 1 MB", async () => {
    const db = fakeDb();
    const f = new FormData();
    f.append("productId", PRODUCT_ID);
    const oversizedBytes = new Uint8Array(1024 * 1024 + 10);
    const file = new File([oversizedBytes], "foto-besar.jpg", { type: "image/jpeg" });
    f.append("photo", file);

    const result = await updateProductPhoto(f, {
      gate: partnerGate(db),
    });

    expect(result.state).toBe("invalid");
    expect(result.message).toContain("Ukuran foto maksimal 1 MB");
    expect(db.updatePhoto).not.toHaveBeenCalled();
  });

  it("menolak bila tidak ada file atau dataUrl yang dipilih", async () => {
    const db = fakeDb();
    const f = form({ productId: PRODUCT_ID });

    const result = await updateProductPhoto(f, {
      gate: partnerGate(db),
    });

    expect(result.state).toBe("invalid");
    expect(result.message).toContain("Pilih file foto");
    expect(db.updatePhoto).not.toHaveBeenCalled();
  });

  it("menolak bila sesi habis atau bukan mitra", async () => {
    const f = form({ productId: PRODUCT_ID, dataUrl: "data:image/jpeg;base64,sample" });

    const resultNoSession = await updateProductPhoto(f, {
      gate: failingGate("session_expired"),
    });
    expect(resultNoSession.state).toBe("session_expired");
    expect(resultNoSession.message).toBe(MESSAGES.sessionExpired);

    const resultNotPartner = await updateProductPhoto(f, {
      gate: failingGate("forbidden"),
    });
    expect(resultNotPartner.state).toBe("forbidden");
    expect(resultNotPartner.message).toBe(MESSAGES.forbidden);
  });
});

describe("Server Action: Hapus Foto Produk", () => {
  it("berhasil menghapus foto (set image_path ke null)", async () => {
    const db = fakeDb({
      updatePhoto: async () => ok(row({ image_path: null, image_alt: null })),
    });
    const onSuccess = vi.fn();
    const f = form({ productId: PRODUCT_ID });

    const result = await deleteProductPhoto(f, {
      gate: partnerGate(db),
      onSuccess,
    });

    expect(result.state).toBe("saved");
    expect(result.message).toContain("Foto produk berhasil dihapus");
    expect(db.updatePhoto).toHaveBeenCalledWith({
      productId: PRODUCT_ID,
      imagePath: null,
      imageAlt: null,
    });
    expect(onSuccess).toHaveBeenCalledWith(PRODUCT_ID);
  });
});
