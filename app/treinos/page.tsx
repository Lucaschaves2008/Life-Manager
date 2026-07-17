import { Hammer } from "lucide-react";
import { Card } from "@/components/caverna/card";
import { EmptyState } from "@/components/caverna/empty-state";

export default function Page() {
  return (
    <Card className="card-in">
      <EmptyState
        icon={Hammer}
        title="O módulo Treinos está sendo construído nas próximas fases."
        className="py-24"
      />
    </Card>
  );
}
