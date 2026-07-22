import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/migration-helper")({
  component: MigrationHelper,
});

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

const publicConfig = {
  SOURCE_SUPABASE_URL: SUPABASE_URL,
  SOURCE_SUPABASE_ANON_KEY: SUPABASE_ANON,
};

const checklist = `CHECKLIST DE MIGRAÇÃO — SUPABASE

1. Configurações públicas (podem ficar no frontend do destino):
   - SOURCE_SUPABASE_URL: ${SUPABASE_URL}
   - SOURCE_SUPABASE_ANON_KEY: ${SUPABASE_ANON}

2. Credenciais privadas (NUNCA colar em página, chat, e-mail ou repositório):
   - Service Role / Secret Key → Supabase Dashboard → Project Settings → API Keys
   - Senha e string de conexão do banco → Supabase Dashboard → Connect
   Configure essas credenciais diretamente como secrets/env vars no projeto de destino.

3. Backup do banco (rodar localmente em terminal seguro):
   supabase login
   supabase link --project-ref SOURCE_PROJECT_REF
   supabase db dump --linked -f supabase-backup.sql

4. Restaurar no destino:
   psql "DESTINATION_DATABASE_URL" -f supabase-backup.sql

5. Nunca commitar .env nem colocar senha do banco no código-fonte.
`;

function copy(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiado`),
    () => toast.error("Falha ao copiar"),
  );
}

function MigrationHelper() {
  const [jsonText] = useState(JSON.stringify(publicConfig, null, 2));

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div className="flex items-start gap-3 rounded-lg border-2 border-destructive bg-destructive/10 p-4 text-destructive">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="font-semibold">
          FERRAMENTA TEMPORÁRIA — APAGUE DEPOIS DA MIGRAÇÃO
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Assistente de Migração do Supabase</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Esta página mostra apenas as configurações <strong>públicas</strong> já
          usadas pelo frontend. Credenciais privadas (service role, secret key,
          senha do banco) nunca são exibidas aqui — obtenha-as diretamente no
          painel do Supabase.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurações públicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL pública do Supabase</Label>
            <Input readOnly value={SUPABASE_URL} onFocus={(e) => e.currentTarget.select()} />
          </div>
          <div className="space-y-2">
            <Label>Chave pública (anon / publishable)</Label>
            <Input readOnly value={SUPABASE_ANON} onFocus={(e) => e.currentTarget.select()} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => copy(jsonText, "Configurações públicas")}>
              <Copy className="mr-2 h-4 w-4" /> Copiar configurações públicas
            </Button>
            <Button variant="outline" onClick={() => copy(checklist, "Checklist")}>
              <Copy className="mr-2 h-4 w-4" /> Copiar checklist de migração
            </Button>
          </div>

          <div className="space-y-2">
            <Label>JSON</Label>
            <pre className="rounded-md border bg-muted p-3 text-xs overflow-auto">
{jsonText}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Credenciais que devem ser obtidas diretamente no Supabase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <div className="font-semibold">Service Role / Secret Key</div>
            <div className="text-muted-foreground">
              Supabase Dashboard → Project Settings → API Keys.
            </div>
          </div>
          <div>
            <div className="font-semibold">Senha e conexão do banco</div>
            <div className="text-muted-foreground">
              Supabase Dashboard → Connect.
            </div>
          </div>
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
            Nunca envie essas credenciais por WhatsApp, e-mail, chat ou página
            pública. Configure diretamente como secrets/env vars no projeto de
            destino.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comandos de migração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-1">
            <div className="font-semibold">Backup (origem)</div>
            <pre className="rounded-md border bg-muted p-3 text-xs overflow-auto">
{`supabase login
supabase link --project-ref SOURCE_PROJECT_REF
supabase db dump --linked -f supabase-backup.sql`}
            </pre>
          </div>
          <div className="space-y-1">
            <div className="font-semibold">Restaurar (destino)</div>
            <pre className="rounded-md border bg-muted p-3 text-xs overflow-auto">
{`psql "DESTINATION_DATABASE_URL" -f supabase-backup.sql`}
            </pre>
          </div>
          <p className="text-muted-foreground">
            Execute os comandos localmente em um terminal seguro. Não coloque a
            senha do banco no código-fonte nem faça commit do arquivo .env.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
