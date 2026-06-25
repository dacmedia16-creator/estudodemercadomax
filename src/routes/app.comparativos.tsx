import { createFileRoute, Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3 } from "lucide-react";

export const Route = createFileRoute("/app/comparativos")({
  component: () => (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Card className="flex flex-col items-center border-dashed border-border/60 p-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BarChart3 className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-xl font-semibold">Comparativos entre estudos</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Em breve você poderá cruzar vários estudos lado a lado para acompanhar a evolução de preços por bairro.
        </p>
        <Link to="/app/estudos" className="mt-6"><Button variant="outline">Ver estudos salvos</Button></Link>
      </Card>
    </div>
  ),
});