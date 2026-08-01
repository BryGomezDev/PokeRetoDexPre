import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-6 p-4">
      <div className="text-center space-y-2">
        <p className="text-8xl font-bold text-gray-700">404</p>
        <h1 className="text-2xl font-semibold">Página no encontrada</h1>
        <p className="text-gray-400 text-sm">
          La página que buscas no existe o fue movida.
        </p>
      </div>
      <Link
        href="/login"
        className="px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors text-sm"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
