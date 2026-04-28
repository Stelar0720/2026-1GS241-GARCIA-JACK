import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Professor from "./pages/Professor";
import ProfessorPoll from "./pages/ProfessorPoll";
import Student from "./pages/Student";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/professor" element={<Professor />} />
        <Route path="/professor/poll/:id" element={<ProfessorPoll />} />
        <Route path="/student" element={<Student />} />
      </Routes>
    </BrowserRouter>
  );
}