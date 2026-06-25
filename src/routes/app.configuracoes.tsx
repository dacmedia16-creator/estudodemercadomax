import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Building2, KeyRound, Globe, Bell } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/configuracoes")({
  component: Configuracoes,
});

function Configuracoes() {
  const [apiKey, setApiKey] = useState("");

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
        <SectionTitle icon={KeyRound} title="Integração com GeckoAPI" badge="Avançado" />
        <p className="mt-2 text-sm text-muted-foreground">
          A coleta de dados dos portais usa a GeckoAPI nos modos PLP (página de listagem) e PDP (página de detalhe).
          Informe sua chave para ativar a busca real — sem chave, o sistema usa dados de demonstração.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <FieldInput label="Endpoint" defaultValue="https://api.geckoapi.com.br/v1/extract" />
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Token de autenticação</Label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Bearer SEU_TOKEN" />
          </div>
        </div>
      </Card>

      <Card className="mt-6 border-border/60 p-6">
        <SectionTitle icon={Globe} title="Portais ativos" />
        <div className="mt-4 space-y-3">
          {[
            { n: "Zap Imóveis", on: true },
            { n: "Viva Real", on: false },
            { n: "OLX", on: false },
            { n: "Imovelweb", on: false },
            { n: "Chaves na Mão", on: false },
          ].map((p) => (
            <div key={p.n} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
              <div>
                <div className="font-medium">{p.n}</div>
                <div className="text-xs text-muted-foreground">{p.on ? "Coleta ativa" : "Em breve"}</div>
              </div>
              <Switch defaultChecked={p.on} disabled={!p.on} />
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