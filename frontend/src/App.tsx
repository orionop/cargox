import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Home from './pages/Home';
import Upload from './pages/Upload';
import Containers from './pages/Containers';
import Retrieve from './pages/Retrieve';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="upload" element={<Upload />} />
          <Route path="containers" element={<Containers />} />
          <Route path="retrieve" element={<Retrieve />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;