// Единая логотип-картинка FBOly для маркетинговых страниц (лендинг,
// тарифы, FAQ, документация) и сайдбара приложения. Просто вордмарк-PNG
// без квадратной иконки и без текстового дублирования рядом.
// Файл обрезан по границам текста (без прозрачных полей), поэтому
// заданная высота = реальная высота букв на экране.
import Image from "next/image";

const ASPECT_RATIO = 1211 / 356; // ширина / высота фактического PNG после обрезки

export function BrandMark({ height = 30 }: { height?: number }) {
  const width = Math.round(height * ASPECT_RATIO);
  return (
    <Image
      src="/fboly-logo.png"
      alt="FBOly"
      width={width}
      height={height}
      priority
      style={{ display: "block", height, width: "auto", objectFit: "contain" }}
    />
  );
}
