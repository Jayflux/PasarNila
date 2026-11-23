import Image from "next/image";

/**
 * Visual hero beranda menampilkan foto usaha kolam budidaya ikan nila.
 */
export function HeroVisual() {
  return (
    <figure className="relative mx-auto w-full max-w-md md:max-w-none">
      <div className="overflow-hidden rounded-[2rem] shadow-xl ring-1 shadow-deep/15 ring-deep/10">
        <Image
          src="/images/kolam-ikan-nila.jpg"
          alt="Kolam budidaya ikan nila dengan sistem aerasi"
          width={1024}
          height={576}
          priority
          sizes="(min-width: 768px) 45vw, 90vw"
          className="h-auto w-full object-cover"
        />
      </div>
      <figcaption className="absolute bottom-4 left-4 rounded-full bg-deep-strong/85 px-3 py-1 text-xs font-medium text-on-deep backdrop-blur-xs">
        Kolam budidaya ikan nila
      </figcaption>
    </figure>
  );
}

