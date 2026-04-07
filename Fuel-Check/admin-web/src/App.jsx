import { Navigate, Route, Routes } from 'react-router-dom';


export default function App() {
  return (
    <Routes>
      <Route path='/' element={<h1>Home</h1>}/>
      <Route path='/about' element={<h1>about</h1>}/>
    </Routes>
  );
}

