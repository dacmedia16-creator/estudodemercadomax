import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import remaxFull from "@/assets/remax-full.png.asset.json";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Estudo de Mercado Pro" },
      { name: "description", content: "Acesse sua conta para gerar e gerenciar estudos de mercado imobiliários." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

const credsSchema = z.object({
  email: z.string().trim().email("Email inválido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<{
    friendly: string;
    raw: Record<string, unknown>;
  } | null>(null);

  // If already signed in, bounce into the app.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) navigate({ to: "/app", replace: true });
    })();
  }, [navigate]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorInfo(null);
    const parsed = credsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return;
    }
    setLoading(true);
    try {
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        if (error) {
          console.error("[auth] signup error", error);
          const friendly = translateAuthError(error);
          setErrorInfo({ friendly, raw: serializeAuthError(error) });
          toast.error(friendly);
          return;
        }
        toast.success("Conta criada! Bem-vindo(a).");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          console.error("[auth] signin error", error);
          const friendly = translateAuthError(error);
          setErrorInfo({ friendly, raw: serializeAuthError(error) });
          toast.error(friendly);
          return;
        }
      }
      navigate({ to: "/app", replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center">
          <img src={remaxFull.url} alt="ESTUDO DE MERCADO" className="h-24 w-auto rounded-lg" />
        </Link>

        <Card className="border-border/60 p-6 shadow-[var(--shadow-elegant)]">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="mb-6 grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-0">
              <h1 className="text-xl font-bold tracking-tight">Bem-vindo de volta</h1>
              <p className="mt-1 text-sm text-muted-foreground">Acesse seus estudos.</p>
            </TabsContent>
            <TabsContent value="signup" className="mt-0">
              <h1 className="text-xl font-bold tracking-tight">Crie sua conta</h1>
              <p className="mt-1 text-sm text-muted-foreground">Comece grátis em segundos.</p>
            </TabsContent>

            <form onSubmit={handle} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@imobiliaria.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={tab === "signup" ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                  disabled={loading}
                />
                {tab === "signup" && (
                  <p className="text-[11px] text-muted-foreground">Mínimo 8 caracteres.</p>
                )}
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {tab === "signup" ? "Criar conta" : "Entrar"}
              </Button>
              {errorInfo && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                  <p className="font-medium text-destructive">{errorInfo.friendly}</p>
                  <details className="mt-2">
                    <summary className="cursor-pointer select-none text-[11px] font-medium text-muted-foreground hover:text-foreground">
                      Ver detalhes técnicos
                    </summary>
                    <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-2 font-mono text-[11px] leading-relaxed text-foreground">
{JSON.stringify(errorInfo.raw, null, 2)}
                    </pre>
                  </details>
                </div>
              )}
            </form>
          </Tabs>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Seus estudos ficam salvos com segurança na sua conta.
        </p>
      </div>
    </div>
  );
}

// Maps Supabase Auth errors to clear, actionable Portuguese messages.
// Prefer `error.code` (stable identifier) over substring matching on the
// human-readable message (which is locale/version-dependent).
function translateAuthError(error: { code?: string; message: string }): string {
  const code = (error.code ?? "").toLowerCase();
  const msg = (error.message ?? "").toLowerCase();

  if (code === "weak_password" || msg.includes("known to be weak") || msg.includes("easy to guess") || msg.includes("pwned")) {
    return "Esta senha é muito comum ou apareceu em vazamentos públicos. Escolha outra — combine letras maiúsculas, minúsculas, números e um símbolo.";
  }
  if (code === "invalid_credentials" || msg.includes("invalid login")) {
    return "Email ou senha incorretos.";
  }
  if (code === "user_already_exists" || msg.includes("user already") || msg.includes("already registered")) {
    return "Já existe uma conta com este email. Use a aba Entrar.";
  }
  if (code === "email_address_invalid" || msg.includes("invalid email")) {
    return "Email inválido. Verifique o endereço informado.";
  }
  if (code === "signup_disabled") {
    return "Cadastro temporariamente desativado. Tente novamente em instantes.";
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || msg.includes("rate limit")) {
    return "Muitas tentativas em sequência. Aguarde alguns segundos e tente de novo.";
  }
  if (code === "email_not_confirmed") {
    return "Confirme seu email antes de entrar.";
  }
  return error.message || "Não foi possível concluir. Tente novamente.";
}

// Extrai os campos úteis de um erro do Supabase Auth (AuthError não é
// serializável diretamente porque os campos vivem no protótipo).
function serializeAuthError(error: unknown): Record<string, unknown> {
  if (!error || typeof error !== "object") return { value: String(error) };
  const e = error as Record<string, unknown> & { message?: string; name?: string };
  return {
    name: e.name,
    message: e.message,
    code: (e as { code?: string }).code,
    status: (e as { status?: number }).status,
    __isAuthError: (e as { __isAuthError?: boolean }).__isAuthError,
    cause: (e as { cause?: unknown }).cause,
  };
}

// Bloqueia o usuário cedo contra as senhas mais óbvias para evitar um
// round-trip até o HIBP do servidor (que retornaria erro mesmo assim).
const OBVIOUS_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "password", "senha123", "12341234",
  "qwerty123", "abcdefgh", "11111111", "00000000", "iloveyou", "admin123",
  "password1", "senhasenha", "87654321", "asdfghjk", "zxcvbnm1",
]);

function PasswordHint({ password }: { password: string }) {
  const isObvious = password.length >= 8 && OBVIOUS_PASSWORDS.has(password.toLowerCase());
  if (isObvious) {
    return (
      <p className="text-[11px] font-medium text-destructive">
        Esta senha é muito comum e será recusada. Misture letras, números e um símbolo (ex.: <span className="font-mono">Radar!Imovel2026</span>).
      </p>
    );
  }
  return (
    <p className="text-[11px] text-muted-foreground">
      Mínimo 8 caracteres. Senhas comuns como <span className="font-mono">12345678</span> ou <span className="font-mono">senha123</span> são bloqueadas — combine letras, números e um símbolo.
    </p>
  );
}