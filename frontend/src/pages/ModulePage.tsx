import type { LucideIcon } from "lucide-react";

import { ComingSoon } from "../components/feedback/ComingSoon";
import { PageContainer } from "../components/layout/PageContainer";
import { PageHeader } from "../components/layout/PageHeader";

interface ModulePageProps {
  description: string;
  detail: string;
  icon: LucideIcon;
  phase: string;
  title: string;
}

export function ModulePage(props: ModulePageProps) {
  return (
    <PageContainer>
      <PageHeader title={props.title} description={props.description} />
      <ComingSoon {...props} />
    </PageContainer>
  );
}
