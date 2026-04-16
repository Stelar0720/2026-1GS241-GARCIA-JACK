import { useNavigate } from "react-router-dom";

export default function Landing() {
  const nav = useNavigate();

  return (
    <div className="flex flex-col items-center gap-4 mt-20">
      <button
        className="bg-blue-500 text-white p-4"
        onClick={() => nav("/professor")}
      >
        Soy Profesor
      </button>

      <button
        className="bg-green-500 text-white p-4"
        onClick={() => nav("/student")}
      >
        Soy Estudiante
      </button>
    </div>
  );
}