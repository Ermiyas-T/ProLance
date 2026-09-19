"use client";

// Contract deliverables sub-route — redirects seamlessly to workspace with deliverables tab active
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ContractDeliverablesPage() {
  const params = useParams();
  const router = useRouter();
  const contractId = params.contractId;

  // redirect to main contract workspace with deliverables tab selected
  useEffect(() => {
    if (contractId) {
      router.replace(`/contracts/${contractId}?tab=deliverables`);
    }
  }, [contractId, router]);

  // render minimal loading state while redirecting
  return (
    <div className="flex flex-1 items-center justify-center min-h-[400px]">
      <p className="text-sm text-muted-foreground animate-pulse">Loading contract deliverables…</p>
    </div>
  );
}
