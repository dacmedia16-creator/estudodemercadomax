import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import remaxIcon from "@/assets/remax-icon-transparent.png.asset.json";
import {
  Search,
  TrendingUp,
  FileText,
  CheckCircle2,
  Building2,
  Sparkles,
  ArrowRight,
  BarChart3,
  Clock,
  ShieldCheck,
  Target,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Estudo de Mercado Pro — Estudos de mercado em minutos" },
      { name: "description", content: "Plataforma de inteligência de mercado para corretores: gere estudos comparativos automáticos com dados reais de portais imobiliários." },
      { property: "og:title", content: "Estudo de Mercado Pro" },
      { property: "og:description", content: "Estudos de mercado imobiliário automáticos para corretores e imobiliárias." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <img src={remaxIcon.url} alt="RE/MAX Única Escolha" className="h-10 w-10 object-contain" />
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold">Imóveis RE/MAX</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">Única Escolha · Estudo de Mercado</span>
            </div>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#como-funciona" className="hover:text-foreground">Como funciona</a>
            <a href="#beneficios" className="hover:text-foreground">Benefícios</a>
            <a href="#exemplo" className="hover:text-foreground">Exemplo</a>
          </nav>
          <Link to="/app/novo-estudo">
            <Button>Entrar na plataforma</Button>
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_oklch(0.95_0.04_152)_0%,_transparent_60%)]" />
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-20 md:pt-28">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Inteligência de mercado para corretores
              </div>
              <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
                Estudo de mercado imobiliário <span className="text-primary">em minutos</span>
              </h1>
              <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
                Preencha os dados do imóvel e receba uma análise comparativa com imóveis semelhantes, faixa de preço recomendada e argumentos para vender ou alugar melhor.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/app/novo-estudo">
                  <Button size="lg" className="gap-2">
                    Gerar meu primeiro estudo <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/app/exemplo">
                  <Button size="lg" variant="outline">Ver exemplo de relatório</Button>
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Sem cartão</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Dados reais</div>
                <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-primary" /> Relatório pronto</div>
              </div>
            </div>
            <div className="relative">
              <Card className="relative overflow-hidden border-border/60 p-6 shadow-[var(--shadow-elegant)]">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-success" />
                    <span className="text-xs font-medium text-muted-foreground">Estudo gerado</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Água Verde · Curitiba</span>
                </div>
                <h3 className="text-lg font-semibold">Apartamento 3 quartos · 110m²</h3>
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[
                    { label: "Comparáveis", value: "12" },
                    { label: "Preço médio", value: "R$ 720k" },
                    { label: "R$/m²", value: "R$ 6.540" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-lg border border-border bg-muted/50 p-3">
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                      <div className="mt-1 text-base font-bold">{s.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs">
                  <div className="font-semibold text-warning-foreground">Acima da média</div>
                  <p className="mt-1 text-muted-foreground">Recomendado: R$ 670k – R$ 770k</p>
                </div>
              </Card>
              <div className="absolute -bottom-4 -right-4 -z-10 h-full w-full rounded-2xl bg-primary/10" />
            </div>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Como funciona</h2>
            <p className="mt-3 text-muted-foreground">Quatro passos simples, do briefing ao relatório.</p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-4">
            {[
              { n: 1, icon: Building2, t: "Informe os dados do imóvel", d: "Preencha tipo, bairro, metragem, quartos, valor pretendido e diferenciais." },
              { n: 2, icon: Search, t: "Buscamos imóveis comparáveis", d: "O sistema consulta os principais portais e organiza os anúncios mais semelhantes." },
              { n: 3, icon: TrendingUp, t: "Calculamos médias e concorrência", d: "Preço por m², faixa competitiva, similaridade e posicionamento de mercado." },
              { n: 4, icon: FileText, t: "Relatório pronto para o cliente", d: "Diagnóstico, argumentos e sugestão de anúncio, tudo exportável em PDF." },
            ].map((s) => (
              <Card key={s.n} className="border-border/60 p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <div className="text-xs font-semibold text-primary">Passo {s.n}</div>
                <h3 className="mt-1 font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="beneficios" className="py-20">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 md:grid-cols-2">
            <div>
              <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Benefícios para corretores</h2>
              <p className="mt-4 text-muted-foreground">Pare de precificar no achismo. Mostre autoridade com dados reais.</p>
            </div>
            <div className="grid gap-4">
              {[
                { icon: Clock, t: "Economize horas de pesquisa manual" },
                { icon: ShieldCheck, t: "Justifique o preço com dados reais" },
                { icon: Target, t: "Mostre autoridade para o proprietário" },
                { icon: BarChart3, t: "Compare imóveis semelhantes em minutos" },
                { icon: FileText, t: "Gere relatórios profissionais para captação" },
              ].map((b) => (
                <div key={b.t} className="flex items-start gap-4 rounded-xl border border-border bg-card p-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <b.icon className="h-5 w-5" />
                  </div>
                  <p className="pt-2 font-medium">{b.t}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="exemplo" className="border-t border-border bg-muted/30 py-20">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">Exemplo de análise</h2>
          <p className="mt-3 text-muted-foreground">Um diagnóstico estratégico, pronto para apresentar ao proprietário.</p>
          <Card className="mt-10 border-border/60 p-8 text-left shadow-[var(--shadow-card)]">
            <div className="mb-4 inline-flex rounded-full bg-warning/15 px-3 py-1 text-xs font-semibold text-warning-foreground">
              Diagnóstico estratégico
            </div>
            <p className="text-lg leading-relaxed text-foreground">
              "Com base nos imóveis encontrados na região, este imóvel está posicionado <strong className="text-primary">acima da média</strong> de mercado. Para aumentar a competitividade, recomenda-se trabalhar uma faixa entre <strong>R$ 6.300</strong> e <strong>R$ 6.900</strong>, destacando metragem, localização e diferenciais como piscina e vagas de garagem."
            </p>
          </Card>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-4xl px-6">
          <Card className="overflow-hidden border-0 p-12 text-center" style={{ background: "var(--gradient-hero)" }}>
            <h2 className="text-3xl font-bold text-primary-foreground md:text-4xl">
              Pare de precificar no achismo
            </h2>
            <p className="mt-4 text-lg text-primary-foreground/90">
              Gere estudos com dados reais e fechepor mais com clareza.
            </p>
            <Link to="/app/novo-estudo">
              <Button size="lg" variant="secondary" className="mt-8 gap-2">
                Gerar meu primeiro estudo <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} Estudo de Mercado Pro</p>
          <p>Feito para corretores que valorizam dados.</p>
        </div>
      </footer>
    </div>
  );
}
