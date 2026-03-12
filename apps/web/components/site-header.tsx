import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="container nav">
      <Link href="/" style={{ fontWeight: 900, fontSize: 22 }}>
        <span style={{ color: "#f59e0b" }}>3D</span>ZAAP
      </Link>
      <nav className="navLinks">
        <Link href="/pricing">Planos</Link>
        <Link href="/login">Entrar</Link>
        <Link href="/signup">Criar conta</Link>
      </nav>
    </header>
  );
}
