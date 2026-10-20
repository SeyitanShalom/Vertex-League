const svgDataPrefix = "data:image/svg+xml;charset=utf-8,";

export function authenticatorQrSource(qr: string) {
  const source = qr.trim();
  if (!source.startsWith("data:")) return svgDataPrefix + encodeURIComponent(source);

  const separator = source.indexOf(",");
  const payload = source.slice(separator + 1);
  if (/^data:image\/svg\+xml(?:;[^,]*)?,/i.test(source) && payload.trimStart().startsWith("<")) {
    return svgDataPrefix + encodeURIComponent(payload);
  }
  return source;
}
