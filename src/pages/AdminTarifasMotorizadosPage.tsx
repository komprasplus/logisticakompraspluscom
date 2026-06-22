import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminTarifasMotorizados from "@/components/admin/AdminTarifasMotorizados";

const AdminTarifasMotorizadosPage = () => (
  <div className="min-h-screen bg-background">
    <header className="border-b border-border bg-card">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-3">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link to="/admin">
            <ArrowLeft className="h-4 w-4" /> Volver al admin
          </Link>
        </Button>
      </div>
    </header>
    <main className="max-w-7xl mx-auto px-4 py-6">
      <AdminTarifasMotorizados />
    </main>
  </div>
);

export default AdminTarifasMotorizadosPage;
