import { Navigate, Route, Routes } from 'react-router-dom';
import OverviewPage from './pages/OverviewPage';


export default function App() {
  return (
    <Routes>
      <Route path='/' element={<h1>Home</h1>}/>
      <Route path='/overview' element={<OverviewPage/>}/>
    </Routes>
  );
}

