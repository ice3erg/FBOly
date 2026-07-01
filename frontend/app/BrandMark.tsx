// Единая логотип-картинка FBOly для маркетинговых страниц (лендинг,
// тарифы, FAQ, документация) и сайдбара приложения. Просто вордмарк-PNG,
// без квадратной иконки и без текстового дублирования рядом.
import Image from "next/image";

export function BrandMark({ size = 22 }: { size?: number }) {
  // Логотип широкий (примерное соотношение сторон ~2.3:1), высоту берём
  // из size, ширину считаем пропорционально.
  const height = Math.round(size * 1.35);
  const width = Math.round(height * 2.3);
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
