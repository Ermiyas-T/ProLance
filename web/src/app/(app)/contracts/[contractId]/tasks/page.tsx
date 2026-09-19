"use client";

// Contract tasks sub-route — redirects seamlessly to workspace with tasks tab active
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ContractTasksPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.contractId;

  // redirect to main contract workspace with tasks tab selected
  useEffect(() => {
    if (contractId) {
      router.replace(`/contracts/${contractId}?tab=tasks`);
    }
  }, [contractId, router]);

  // render minimal loading state while redirecting
  return (
    <div className="flex flex-1 items-center justify-center min-h-[400px]">
      <p className="text-sm text-muted-foreground animate-pulse">Loading contract tasks…</p>
    </div>
  );
}
