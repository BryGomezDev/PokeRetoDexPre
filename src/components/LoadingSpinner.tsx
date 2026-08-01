export function LoadingSpinner({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-gray-700 border-t-red-500 rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">{message}</p>
      </div>
    </div>
  );
}
