import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Building2, KeyRound, Globe, Bell, CheckCircle2, XCircle, Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { geckoStatus, geckoTest, geckoTestPlp } from "@/lib/gecko.functions";

export const Route = createFileRoute("/app/configuracoes")({
  component: Configuracoes,
});

function Configuracoes() {
  const [tokenConfigured, setTokenConfigured] = useState<boolean | null>(null);
  const [endpoint, setEndpoint] = useState("https://api.geckoapi.com.br/v1/extract");
  const [testUrl, setTestUrl] = useState("https://www.zapimoveis.com.br/imovel/aluguel-apartamento-4-quartos-com-piscina-agua-verde-curitiba-pr-158m2-id-2795564422/");
  const [testTarget, setTestTarget] = useState<"zapimoveis.com.br" | "chavesnamao.com.br" | "olx.com.br">("zapimoveis.com.br");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<null | { ok: boolean; message: string; sample?: string }>(null);
  const [plpKeyword, setPlpKeyword] = useState("apartamento 3 quartos");
  const [plpCity, setPlpCity] = useState("Curitiba");
  const [plpTesting, setPlpTesting] = useState(false);
  const [plpResult, setPlpResult] = useState<null | { ok: boolean; message: string; sample?: string }>(null);
  const [chavesOn, setChavesOn] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return true;
    const v = localStorage.getItem("portal.chavesnamao");
    return v === null ? true : v === "1" || v === "true";
  });
  const [olxOn, setOlxOn] = useState<boolean>(() => {
    if (typeof localStorage === "undefined") return false;
    const v = localStorage.getItem("portal.olx");
    return v === null ? false : v === "1" || v === "true";
  });

  const toggleChaves = (on: boolean) => {
    setChavesOn(on);
    try { localStorage.setItem("portal.chavesnamao", on ? "1" : "0"); } catch {}
    toast.success(on ? "Chaves na Mão ativada nas buscas." : "Chaves na Mão desativada.");
  };
  const toggleOlx = (on: boolean) => {
    setOlxOn(on);
    try { localStorage.setItem("portal.olx", on ? "1" : "0"); } catch {}
    toast.success(on ? "OLX ativada nas buscas." : "OLX desativada.");
  };

  useEffect(() => {
    geckoStatus().then((s) => {
      setTokenConfigured(s.configured);
      setEndpoint(s.endpoint);
    }).catch(() => setTokenConfigured(false));
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await geckoTest({ data: { url: testUrl, target: testTarget } });
      if (res.ok) {
        const d = res.data as Record<string, any> | null;
        const sample = d
          ? `Título: ${d.title ?? d.description ?? "—"}\nPreço: ${d.price ?? d.prices?.mainValue ?? "—"}\nBairro: ${d.address?.neighborhood ?? "—"}`
          : res.notFound
          ? "Resposta 200 com notFound: true (URL não encontrada na origem)"
          : "Sem dados";
        setTestResult({ ok: true, message: `Conexão OK — HTTP ${res.status}`, sample });
        toast.success("Conexão GeckoAPI funcionando!");
      } else {
        setTestResult({ ok: false, message: `${res.errorCode ?? "ERRO"} — ${res.errorMessage ?? "Falha"}` });
        toast.error("Falha no teste da GeckoAPI");
      }
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message });
      toast.error("Erro ao testar GeckoAPI");
    } finally {
      setTesting(false);
    }
  };

  const handleTestPlp = async () => {
    setPlpTesting(true);
    setPlpResult(null);
    try {
      const res = await geckoTestPlp({ data: { target: testTarget, city: plpCity, keyword: plpKeyword, businessType: "sale" } });
      if (res.ok) {
        const d = res.data as any;
        const items = d?.items ?? [];
        const first = items[0] ?? null;
        const sample = `Itens recebidos: ${items.length}\n${first ? `Primeiro item — chaves:\n${Object.keys(first).join(", ")}\n\nJSON:\n${JSON.stringify(first, null, 2).slice(0, 1500)}` : "Nenhum item retornado."}`;
        setPlpResult({ ok: true, message: `Conexão OK — HTTP ${res.status}`, sample });
        toast.success(`PLP ${testTarget} retornou ${items.length} itens`);
      } else {
        setPlpResult({ ok: false, message: `${res.errorCode ?? "ERRO"} — ${res.errorMessage ?? "Falha"}` });
        toast.error("Falha no teste PLP");
      }
    } catch (e) {
      setPlpResult({ ok: false, message: (e as Error).message });
    } finally {
      setPlpTesting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary">Configurações</div>
        <h1 className="text-3xl font-bold tracking-tight">Perfil e integrações</h1>
        <p className="mt-1 text-muted-foreground">Personalize os relatórios com seus dados e conecte os portais.</p>
      </div>

      <Card className="border-border/60 p-6">
        <SectionTitle icon={Building2} title="Dados do corretor ou imobiliária" />
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FieldInput label="Nome comercial" defaultValue="Imobiliária Exemplo" />
          <FieldInput label="CRECI" defaultValue="12345-J" />
          <FieldInput label="WhatsApp" defaultValue="(41) 99999-9999" />
          <FieldInput label="E-mail" defaultValue="contato@exemplo.com.br" type="email" />
          <FieldInput label="Logo (URL)" defaultValue="" className="md:col-span-2" />
        </div>
      </Card>

      <Card className="mt-6 border-border/60 p-6">
        <SectionTitle icon={KeyRound} title="Configurações técnicas — GeckoAPI" badge="Avançado" />
        <p className="mt-2 text-sm text-muted-foreground">
          A coleta usa a GeckoAPI nos modos PLP (página de listagem) e PDP (página de detalhe).
          O token fica protegido como segredo do projeto — sem token, o sistema usa dados de demonstração.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Endpoint</Label>
            <Input value={endpoint} readOnly className="bg-muted/40" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Status do token</Label>
            <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm">
              {tokenConfigured === null ? (
                <><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> Verificando...</>
              ) : tokenConfigured ? (
                <><CheckCircle2 className="h-4 w-4 text-primary" /> <span className="font-medium">Configurado</span></>
              ) : (
                <><XCircle className="h-4 w-4 text-destructive" /> <span className="font-medium">Não configurado</span></>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Portal ativo</Label>
            <Input value="Zap Imóveis (zapimoveis.com.br)" readOnly className="bg-muted/40" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Tipo de extração padrão</Label>
            <Input value="PLP + PDP (enriquecimento)" readOnly className="bg-muted/40" />
          </div>
        </div>

        <Separator className="my-6" />

        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4 text-primary" /> Testar API</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Cole uma URL pública de imóvel do Zap Imóveis para validar a integração via PDP.
          </p>
          <div className="mt-3 flex gap-2">
            <select
              value={testTarget}
              onChange={(e) => {
                const v = e.target.value as "zapimoveis.com.br" | "chavesnamao.com.br" | "olx.com.br";
                setTestTarget(v);
                setTestUrl(
                  v === "chavesnamao.com.br"
                    ? "https://www.chavesnamao.com.br/imovel/apartamento-a-venda-4-quartos-com-garagem-sc-balneario-picarras-centro-496m2-RS5990000/id-29279133/"
                    : v === "olx.com.br"
                    ? "https://sp.olx.com.br/sorocaba-e-regiao/imoveis/apartamento-3-quartos-parque-campolim-sorocaba-1234567890"
                    : "https://www.zapimoveis.com.br/imovel/aluguel-apartamento-4-quartos-com-piscina-agua-verde-curitiba-pr-158m2-id-2795564422/",
                );
              }}
              className="h-9 rounded-md border border-input bg-card px-2 text-sm"
            >
              <option value="zapimoveis.com.br">Zap Imóveis</option>
              <option value="chavesnamao.com.br">Chaves na Mão</option>
              <option value="olx.com.br">OLX</option>
            </select>
            <Input value={testUrl} onChange={(e) => setTestUrl(e.target.value)} placeholder="https://www..." />
            <Button onClick={handleTest} disabled={testing || !testUrl} className="gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Testar
            </Button>
          </div>
          {testResult && (
            <div className={`mt-3 rounded-lg border p-3 text-xs ${testResult.ok ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
              <div className="font-semibold">{testResult.ok ? "✓" : "✗"} {testResult.message}</div>
              {testResult.sample && <pre className="mt-2 whitespace-pre-wrap text-muted-foreground">{testResult.sample}</pre>}
            </div>
          )}
        </div>

        <Separator className="my-6" />

        <div>
          <h4 className="flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4 text-primary" /> Testar PLP (listagem)</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Dispara uma busca real no portal selecionado acima e mostra o JSON cru do primeiro item — útil para validar o shape de cada portal.
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
            <Input value={plpCity} onChange={(e) => setPlpCity(e.target.value)} placeholder="Cidade (ex: Curitiba)" />
            <Input value={plpKeyword} onChange={(e) => setPlpKeyword(e.target.value)} placeholder="Keyword (ex: apartamento 3 quartos)" />
            <Button onClick={handleTestPlp} disabled={plpTesting || (!plpCity && !plpKeyword)} className="gap-2">
              {plpTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Testar PLP
            </Button>
          </div>
          {plpResult && (
            <div className={`mt-3 rounded-lg border p-3 text-xs ${plpResult.ok ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
              <div className="font-semibold">{plpResult.ok ? "✓" : "✗"} {plpResult.message}</div>
              {plpResult.sample && <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-muted-foreground">{plpResult.sample}</pre>}
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6 border-border/60 p-6">
        <SectionTitle icon={Globe} title="Portais ativos" />
        <div className="mt-4 space-y-3">
          {[
            { n: "Zap Imóveis", on: true, locked: true, checked: true },
            { n: "Chaves na Mão", on: true, locked: false, checked: chavesOn, toggle: toggleChaves },
            { n: "Viva Real", on: false, locked: true, checked: false },
            { n: "OLX", on: true, locked: false, checked: olxOn, toggle: toggleOlx },
            { n: "Imovelweb", on: false, locked: true, checked: false },
          ].map((p) => (
            <div key={p.n} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div>
                <div className="font-medium">{p.n}</div>
                <div className="text-xs text-muted-foreground">
                  {p.locked ? (p.on ? "Sempre ativo" : "Em breve") : p.checked ? "Coleta ativa nas buscas" : "Desativado"}
                </div>
              </div>
              <Switch
                checked={p.checked}
                disabled={p.locked}
                onCheckedChange={(v) => p.toggle?.(v)}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-6 border-border/60 p-6">
        <SectionTitle icon={Bell} title="Preferências de relatório" />
        <div className="mt-4 space-y-3">
          {["Incluir gráficos no PDF", "Mostrar logo no cabeçalho", "Enviar cópia por e-mail"].map((p) => (
            <div key={p} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div className="font-medium">{p}</div>
              <Switch defaultChecked />
            </div>
          ))}
        </div>
      </Card>

      <Separator className="my-8" />
      <div className="flex justify-end">
        <Button onClick={() => toast.success("Configurações salvas!")}>Salvar configurações</Button>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, badge }: { icon: typeof Building2; title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{title}</h3>
        {badge && <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">{badge}</span>}
      </div>
    </div>
  );
}

function FieldInput({ label, className, ...props }: React.ComponentProps<typeof Input> & { label: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-sm font-medium">{label}</Label>
      <Input {...props} />
    </div>
  );
}