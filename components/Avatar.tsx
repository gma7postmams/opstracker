export default function Avatar({ url, name, size = 32 }: { url?: string | null; name: string; size?: number }) {
  const initials = name.split(" ").filter((p) => !p.endsWith("."))
    .map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";
  if (url) {
    return <img className="avatar" src={url} alt=""
      style={{ width: size, height: size, objectFit: "cover" }} />;
  }
  return <div className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}>{initials}</div>;
}
