import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

interface Props {
  images: string[];
  alt: string;
  className?: string;
}

/**
 * Carrossel leve de fotos do anúncio. Setas + bullets, controles `print:hidden`
 * para o PDF mostrar só a capa. Se uma imagem quebra, removemos ela da lista
 * e avançamos sozinho para a próxima — evita card vazio quando o portal
 * devolve URL inválida.
 */
export function PropertyPhotosCarousel({ images, alt, className }: Props) {
  const initial = useMemo(() => images.filter(Boolean), [images]);
  const [list, setList] = useState<string[]>(initial);
  const [idx, setIdx] = useState(0);

  if (list.length === 0) {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-muted text-muted-foreground ${className ?? ""}`}>
        <ImageOff className="h-6 w-6 opacity-50" />
      </div>
    );
  }

  const cur = list[Math.min(idx, list.length - 1)];
  const total = list.length;
  const go = (delta: number) => setIdx((i) => (i + delta + total) % total);
  const handleError = () => {
    setList((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setIdx((i) => (next.length ? i % next.length : 0));
      return next;
    });
  };

  return (
    <div className={`relative h-full w-full overflow-hidden bg-muted ${className ?? ""}`}>
      <img
        key={cur}
        src={cur}
        alt={alt}
        className="h-full w-full object-cover"
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={handleError}
      />
      {total > 1 && (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={() => go(-1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white opacity-0 transition hover:bg-black/65 group-hover:opacity-100 focus:opacity-100 print:hidden"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={() => go(1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/45 p-1.5 text-white opacity-0 transition hover:bg-black/65 group-hover:opacity-100 focus:opacity-100 print:hidden"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white print:hidden">
            {idx + 1}/{total}
          </div>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1 print:hidden">
            {list.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Foto ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-white" : "w-1.5 bg-white/55 hover:bg-white/80"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}