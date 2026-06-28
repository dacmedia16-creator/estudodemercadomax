import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Radar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar — Radar Imobiliário Pro" },
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

  // If already signed in, bounce into the app.
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) navigate({ to: "/app/novo-estudo", replace: true });
    })();
  }, [navigate]);

  const handle = async (e: React.FormEvent) => {
    e.preventDefault();
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
          options: { emailRedirectTo: `${window.location.origin}/app/novo-estudo` },
        });
        if (error) {
          toast.error(translateAuthError(error));
          return;
        }
        toast.success("Conta criada! Bem-vindo(a).");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          toast.error(translateAuthError(error));
          return;
        }
      }
      navigate({ to: "/app/novo-estudo", replace: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Radar className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold">Radar Imobiliário</div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">Pro</div>
          </div>
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
                  <PasswordHint password={password} />
                )}
              </div>
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {tab === "signup" ? "Criar conta" : "Entrar"}
              </Button>
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