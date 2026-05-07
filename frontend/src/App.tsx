import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import ChatView from './pages/ChatView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<ChatView />} />
          <Route path="c/:id" element={<ChatView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
