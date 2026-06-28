import { useQuery } from "@tanstack/react-query";
import { getMyRoles } from "@/lib/admin.functions";

export function useIsAdmin() {
  const { data, isLoading } = useQuery({
    queryKey: ["my-roles"],
    queryFn: () => getMyRoles(),
    staleTime: 60_000,
  });
  return { isAdmin: !!data?.roles.includes("admin"), isLoading };
}