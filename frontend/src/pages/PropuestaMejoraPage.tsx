import { useState } from "react";
import { apiClient } from "../api/client";
import { Lightbulb, Send, CheckCircle2 } from "lucide-react";

export default function PropuestaMejoraPage() {
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;
    setSending(true);
    setError("");
    try {
      await apiClient.post("/auth/propuesta-mejora/", { texto: texto.trim() });
      setSent(true);
      setTexto("");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Error al enviar la propuesta. Inténtalo de nuevo.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Lightbulb size={20} className="text-amber-400" />
        <h1 className="text-lg font-semibold text-gray-700">Propuestas de Mejora</h1>
      </div>
      <p className="text-sm text-gray-400 mb-6">
        ¿Tienes alguna idea o sugerencia para mejorar la plataforma? Escríbela aquí y la recibiremos directamente.
      </p>

      {sent ? (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
          <CheckCircle2 size={20} className="text-green-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800">¡Propuesta enviada!</p>
            <p className="text-sm text-green-600 mt-0.5">
              Gracias por tu feedback. Lo tendremos en cuenta.
            </p>
            <button
              className="mt-3 text-xs text-green-700 underline hover:no-underline"
              onClick={() => setSent(false)}
            >
              Enviar otra propuesta
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <textarea
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 resize-none transition"
              rows={6}
              maxLength={2000}
              placeholder="Describe tu idea o sugerencia de mejora..."
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              required
            />
            <div className="flex justify-between mt-1 px-1">
              {error ? (
                <p className="text-xs text-red-500">{error}</p>
              ) : (
                <span />
              )}
              <span className="text-xs text-gray-300">{texto.length}/2000</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={sending || !texto.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={14} />
            {sending ? "Enviando..." : "Enviar propuesta"}
          </button>
        </form>
      )}
    </div>
  );
}
