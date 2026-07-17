import { useQuery } from "@tanstack/react-query";
import { getMyRoles } from "@/lib/admin.functions";

export function useIsGestor() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => getMyRoles(),
    staleTime: 60_000,
  });
  const roles = data?.roles ?? [];
  return {
    isGestor: roles.includes("gestor") || roles.includes("admin"),
    isAdmin: roles.includes("admin"),
    isLoading,
  };
}