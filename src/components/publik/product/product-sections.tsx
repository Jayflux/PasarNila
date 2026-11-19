import { notFound } from "next/navigation";

import { PackageDetailLink, PackageOffers } from "@/components/publik/product/package-offers";
import {
  ConfirmedAtNote,
  ProductDescription,
  ProductLoadError,
  ProductMedia,
  StockPriceFacts,
} from "@/components/publik/product/product-facts";
import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { logReadError } from "@/lib/data/log";
import { loadPublishedCatalog } from "@/lib/data/packages";
import { PRIMARY_PRODUCT_FALLBACK_NAME, PRIMARY_PRODUCT_SLUG } from "@/lib/data/products";
import { getProductDisplay } from "@/lib/domain/product-status";
import { getProductWhatsAppHref } from "@/lib/whatsapp-links";

/**
 * Bagian produk untuk beranda, katalog, dan detail (PRD FR-01–FR-03, §12.8; ARCHITECTURE §12.3).
 * Satu sumber data (`loadPublishedCatalog`, tanpa cache). Pemanggil membungkusnya dengan <Suspense>.
 *
 * Bila produk gagal dimuat: pesan gangguan (AC-12), tanpa stok/harga/paket; WhatsApp tetap tersedia.
 */

const cardShell =
  "grid overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm md:grid-cols-[0.85fr_1.15fr]";

export async function ProductSummaryCard({ headingLevel = "h3" }: { headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const { product: result, packages } = await loadPublishedCatalog(PRIMARY_PRODUCT_SLUG);

  if (result.status === "not_found") {
    // PRD NFR-13: tidak ada produk terbit.
    return (
      <div className={cardShell}>
        <ProductMedia productName={PRIMARY_PRODUCT_FALLBACK_NAME} />
        <div className="flex flex-col justify-center gap-5 p-6 sm:p-8">
          <p className="text-xl font-semibold text-ink">Produk belum tersedia</p>
          <WhatsAppButton
            href={getProductWhatsAppHref("product_unknown", PRIMARY_PRODUCT_FALLBACK_NAME)}
            label="Tanya via WhatsApp"
            className="self-start"
          />
        </div>
      </div>
    );
  }

  const display = getProductDisplay(
    result.status === "ok" ? { status: "ok", data: result.product.stockPrice } : { status: "error" },
  );
  if (display.status === "error" && display.reason === "invalid_data") {
    logReadError("products", new Error("nilai stok/harga/waktu tersimpan tidak konsisten"));
  }
  const productName = result.status === "ok" ? result.product.name : PRIMARY_PRODUCT_FALLBACK_NAME;
  const whatsappHref = getProductWhatsAppHref(display.whatsAppMessageKind, productName);

  return (
    <article aria-labelledby="produk-ringkas-nama" className={cardShell}>
      <ProductMedia
        imagePath={result.status === "ok" ? result.product.imagePath : null}
        imageAlt={result.status === "ok" ? result.product.imageAlt : null}
        productName={productName}
      />
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <Heading id="produk-ringkas-nama" className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {productName}
          </Heading>
          {result.status === "ok" ? <ProductDescription description={result.product.shortDescription} className="mt-3" /> : null}
        </div>

        {display.status === "ok" && result.status === "ok" ? (
          <>
            <StockPriceFacts stock={display.stock} price={display.price} />
            <ConfirmedAtNote label={display.confirmedAtLabel} />
            {packages ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-ink">Pilihan paket</p>
                <PackageOffers
                  variant="compact"
                  productName={productName}
                  slug={PRIMARY_PRODUCT_SLUG}
                  stockKg={result.product.stockPrice.stockKg}
                  unitPricePerKgIdr={result.product.stockPrice.pricePerKgIdr}
                  packages={packages}
                />
              </div>
            ) : null}
          </>
        ) : (
          <ProductLoadError message={display.status === "error" ? display.message : "Informasi produk sedang tidak dapat dimuat"} />
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <PackageDetailLink slug={PRIMARY_PRODUCT_SLUG} />
          <WhatsAppButton href={whatsappHref} label={`Tanya ${productName} via WhatsApp`} />
        </div>
      </div>
    </article>
  );
}

export async function ProductDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { product: result, packages } = await loadPublishedCatalog(slug);
  if (result.status === "not_found") notFound();

  const display = getProductDisplay(
    result.status === "ok" ? { status: "ok", data: result.product.stockPrice } : { status: "error" },
  );
  if (display.status === "error" && display.reason === "invalid_data") {
    logReadError("products", new Error("nilai stok/harga/waktu tersimpan tidak konsisten"));
  }
  const productName = result.status === "ok" ? result.product.name : PRIMARY_PRODUCT_FALLBACK_NAME;
  const whatsappHref = getProductWhatsAppHref(display.whatsAppMessageKind, productName, slug);
  const loaded = display.status === "ok" && result.status === "ok";

  return (
    <div className="space-y-10">
      <article aria-labelledby="produk-detail-nama" className="overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm">
        <div className="grid md:grid-cols-[0.85fr_1.15fr]">
          <ProductMedia
            imagePath={result.status === "ok" ? result.product.imagePath : null}
            imageAlt={result.status === "ok" ? result.product.imageAlt : null}
            productName={productName}
            className="min-h-32 md:min-h-80"
          />
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <div>
              <h1 id="produk-detail-nama" className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                {productName}
              </h1>
              {result.status === "ok" ? <ProductDescription description={result.product.shortDescription} className="mt-3" /> : null}
            </div>
            {display.status === "ok" ? (
              <>
                <StockPriceFacts stock={display.stock} price={display.price} />
                <ConfirmedAtNote label={display.confirmedAtLabel} />
              </>
            ) : (
              <ProductLoadError message={display.message} />
            )}
            <WhatsAppButton href={whatsappHref} label={`Tanya ${productName} via WhatsApp`} className="self-stretch sm:self-start" />
          </div>
        </div>
      </article>

      <section aria-labelledby="paket-judul" className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
        <h2 id="paket-judul" className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          Pilihan paket
        </h2>
        <p className="mt-2 max-w-2xl text-ink-muted">
          Harga total setiap paket ditentukan penjual. Pilih paket untuk menghubungi penjual lewat WhatsApp dengan pesan
          yang sudah terisi; pesanan dan ketersediaan disepakati di sana.
        </p>
        <div className="mt-8">
          {loaded && packages && result.status === "ok" ? (
            <PackageOffers
              variant="full"
              productName={productName}
              slug={slug}
              stockKg={result.product.stockPrice.stockKg}
              unitPricePerKgIdr={result.product.stockPrice.pricePerKgIdr}
              packages={packages}
            />
          ) : (
            <p role="status" className="rounded-2xl border border-error-ink/20 bg-error-soft p-4 text-sm font-semibold text-error-ink">
              Pilihan paket tidak ditampilkan karena informasi produk sedang tidak dapat dimuat.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
